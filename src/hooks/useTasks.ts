import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { archiveStaleTasks } from "../archive";
import { weekKey } from "../balance";
import { Completion, loadLog, pruneLog, saveLog, seedLog, updateLog } from "../completionLog";
import { t } from "../i18n";
import { SNOOZE_MINUTES } from "../notifications/schedule";
import { shouldEscalate } from "../notifications/status";
import { defaultNotifier, Notifier } from "../notifications/service";
import {
  defaultReminderFields,
  keepRelevantFields,
  pickReminderFields,
} from "../reminders";
import { DEFAULT_SETTINGS, notificationSettingsKey, Settings } from "../settings";
import { loadTasks, saveTasks } from "../storage";
import { nextOccurrence } from "../recurrence";
import { Category, ReminderFields, Task } from "../types";

// setTimeout ne gère pas les délais > ~24,8 jours : on plafonne et on revérifie
const MAX_TIMEOUT_MS = 60 * 60 * 1000;
// Les modifications rapprochées (coche puis identifiants de notification…) sont écrites ensemble
export const SAVE_DELAY_MS = 400;

export const isForeground = (state: string | null | undefined) =>
  state !== "background" && state !== "inactive";

export interface TaskInput extends Partial<ReminderFields> {
  title: string;
  category: Category;
}

// Dernière bascule automatique en Faire, avec les tâches telles qu'elles étaient (« Annuler »)
export interface Escalation {
  at: number;
  before: Task[];
}

// Tâche retirée de la liste, avec sa position pour pouvoir l'annuler
export interface RemovedTask {
  task: Task;
  index: number;
}

// Identifiant unique, même pour deux tâches créées dans la même milliseconde
const newId = (now: number) =>
  `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Supprime les clés à undefined pour qu'elles n'écrasent rien lors d'un spread
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// Tout ce qui influence les notifications d'une tâche (sauf leurs identifiants et la priorité)
const scheduleSignature = (task: Task) =>
  JSON.stringify({ ...task, notificationIds: undefined, priorityWeek: undefined });

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

// settingsReady : réglages enregistrés lus ; aucune notification n'est programmée avant
export function useTasks(
  settings: Settings = DEFAULT_SETTINGS,
  notifier: Notifier = defaultNotifier,
  settingsReady: boolean = true
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  // Empêche la sauvegarde tant que les tâches n'ont pas été chargées.
  // Si la lecture échoue, il reste à false : on ne risque pas d'écraser les données existantes.
  const [isLoaded, setIsLoaded] = useState(false);
  // Lecture impossible : l'app affiche un message et bloque la saisie (rien ne serait enregistré)
  const [loadError, setLoadError] = useState(false);
  // Dernière liste rendue, pour connaître la position des tâches supprimées
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---- Synchronisation des notifications ----
  // Signatures déjà synchronisées (null avant la première réconciliation)
  const syncedRef = useRef<Map<string, string> | null>(null);
  // Identifiants programmés connus pour chaque tâche
  const idsRef = useRef(new Map<string, string[]>());
  // Réglages des rappels utilisés par la dernière réconciliation complète
  const reconciledKeyRef = useRef<string | null>(null);
  // Les synchronisations s'exécutent l'une après l'autre
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (job: () => Promise<void>) => {
    queueRef.current = queueRef.current
      .then(job)
      .catch((e) => console.warn("Erreur notifications :", e));
  };

  // Enregistre les nouveaux identifiants dans les tâches (sans toucher à leur signature)
  const applyIds = (idsByTask: Record<string, string[]>) => {
    for (const [id, ids] of Object.entries(idsByTask)) idsRef.current.set(id, ids);
    setTasks((prev) =>
      prev.some((t) => idsByTask[t.id] && !sameIds(t.notificationIds, idsByTask[t.id]))
        ? prev.map((t) =>
            idsByTask[t.id] && !sameIds(t.notificationIds, idsByTask[t.id])
              ? { ...t, notificationIds: idsByTask[t.id] }
              : t
          )
        : prev
    );
  };

  // Annule les orphelines et reprogramme ce qui manque, pour toutes les tâches
  const reconcileAll = () => {
    reconciledKeyRef.current = notificationSettingsKey(settingsRef.current);
    enqueue(async () => {
      applyIds(await notifier.reconcile(tasksRef.current, settingsRef.current));
    });
  };

  // ---- Journal des fins de tâches (bilan) ----
  const [completions, setCompletions] = useState<Completion[]>([]);
  // Journal lu (ou créé) : avant, rien n'est écrit pour ne pas écraser celui qui existe
  const logReadyRef = useRef(false);
  // Tâches lors du dernier passage, pour repérer celles qui viennent d'être terminées ou rouvertes
  const loggedTasksRef = useRef<Task[] | null>(null);

  // Charger les tâches sauvegardées (au démarrage, ou « Réessayer » après une erreur), puis le
  // journal des fins de tâches
  const load = () => {
    (async () => {
      let loaded: Task[];
      try {
        loaded = await loadTasks();
        setTasks(loaded);
        setIsLoaded(true);
        setLoadError(false);
      } catch (e) {
        console.warn("Erreur récupération tâches :", e);
        setLoadError(true);
        return;
      }
      try {
        const now = Date.now();
        const saved = await loadLog();
        // Premier lancement avec le journal : rempli une seule fois avec les tâches terminées
        const log = pruneLog(saved ?? seedLog(loaded, now), now);
        if (saved === null || log !== saved) await saveLog(log);
        logReadyRef.current = true;
        setCompletions((current) => [...log, ...current]);
      } catch (e) {
        console.warn("Erreur journal des tâches terminées :", e);
      }
    })();
  };

  useEffect(load, []);

  const retryLoad = () => {
    if (!isLoaded) load();
  };

  // Tâche terminée : ajoutée au journal ; rouverte (« Annuler ») : retirée
  useEffect(() => {
    if (!isLoaded) return;
    const previous = loggedTasksRef.current;
    loggedTasksRef.current = tasks;
    if (previous === null || previous === tasks) return;
    setCompletions((log) => pruneLog(updateLog(log, previous, tasks), Date.now()));
  }, [tasks, isLoaded]);

  // Écritures du journal regroupées comme celles des tâches (au plus une toutes les
  // SAVE_DELAY_MS) ; immédiates hors de l'écran
  const pendingLogRef = useRef<Completion[] | null>(null);
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushLog = () => {
    if (logTimerRef.current !== null) clearTimeout(logTimerRef.current);
    logTimerRef.current = null;
    const pending = pendingLogRef.current;
    if (pending === null) return;
    pendingLogRef.current = null;
    saveLog(pending).catch((e) => console.warn("Erreur sauvegarde journal :", e));
  };

  useEffect(() => {
    if (!logReadyRef.current) return;
    pendingLogRef.current = completions;
    if (!isForeground(AppState.currentState)) flushLog();
    else if (logTimerRef.current === null) logTimerRef.current = setTimeout(flushLog, SAVE_DELAY_MS);
  }, [completions]);

  // ---- Sauvegarde ----
  // Liste à écrire et écriture programmée
  const pendingSaveRef = useRef<Task[] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = () => {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const pending = pendingSaveRef.current;
    if (pending === null) return;
    pendingSaveRef.current = null;
    saveTasks(pending).catch((e) => console.warn("Erreur sauvegarde tâches :", e));
  };

  // Sauvegarder chaque modification de la liste (une fois le chargement terminé), au plus une
  // écriture toutes les SAVE_DELAY_MS. Hors de l'écran, écriture immédiate : les minuteries
  // peuvent y être suspendues et l'app arrêtée à tout moment.
  useEffect(() => {
    if (!isLoaded) return;
    pendingSaveRef.current = tasks;
    if (!isForeground(AppState.currentState)) flushSave();
    else if (saveTimerRef.current === null) {
      saveTimerRef.current = setTimeout(flushSave, SAVE_DELAY_MS);
    }
  }, [tasks, isLoaded]);

  // Rien ne reste en attente quand l'app quitte l'écran ou que le fournisseur est démonté
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (!isForeground(state)) {
        flushSave();
        flushLog();
      }
    });
    return () => {
      subscription.remove();
      flushSave();
      flushLog();
    };
  }, []);

  // Ajout, modification, déplacement, coche, suppression, annulation, restauration :
  // toute tâche dont la signature change est resynchronisée, toute tâche disparue est annulée.
  useEffect(() => {
    // La première réconciliation attend les réglages enregistrés : sinon elle programmerait
    // avec les réglages par défaut, puis tout serait annulé et reprogrammé
    if (!isLoaded || !settingsReady) return;
    const signatures = new Map(tasks.map((t) => [t.id, scheduleSignature(t)]));
    const previous = syncedRef.current;
    syncedRef.current = signatures;

    // Premier passage après le chargement : réconciliation complète
    if (previous === null) {
      reconcileAll();
      return;
    }

    const changed = tasks.filter((t) => previous.get(t.id) !== signatures.get(t.id));
    const removedIds = [...previous.keys()].filter((id) => !signatures.has(id));
    if (changed.length === 0 && removedIds.length === 0) return;

    enqueue(async () => {
      for (const id of removedIds) {
        await notifier.cancel(idsRef.current.get(id) ?? []);
        idsRef.current.delete(id);
      }
      const result: Record<string, string[]> = {};
      let truncated = false;
      for (const task of changed) {
        const known = idsRef.current.get(task.id) ?? task.notificationIds;
        result[task.id] = await notifier.syncTask(
          { ...task, notificationIds: known },
          settingsRef.current,
          undefined,
          () => (truncated = true)
        );
        idsRef.current.set(task.id, result[task.id]);
      }
      applyIds(result);
      // Plafond de 64 atteint : réconciliation complète, pour garder les plus proches
      if (truncated) reconcileAll();
    });
  }, [tasks, isLoaded, settingsReady]);

  // Option activée : archive les tâches « Si j'ai le temps » restées 7 jours,
  // au chargement puis dès que l'option est cochée. Désactivée, rien n'est archivé
  // et les tâches déjà archivées le restent.
  useEffect(() => {
    if (isLoaded && settings.autoArchive) {
      setTasks((prev) => archiveStaleTasks(prev, Date.now()));
    }
  }, [isLoaded, settings.autoArchive]);

  // Réglages des rappels modifiés : tout est reprogrammé. Les autres réglages (animations,
  // archivage) et la relecture de réglages identiques au démarrage ne déclenchent rien.
  const notificationKey = notificationSettingsKey(settings);
  useEffect(() => {
    if (syncedRef.current !== null && notificationKey !== reconciledKeyRef.current) reconcileAll();
  }, [notificationKey]);

  // À chaque retour dans l'app : reprogramme les notifications suivantes (limite iOS de 64)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && syncedRef.current !== null) reconcileAll();
    });
    return () => subscription.remove();
  }, []);

  // ---- Expiration des timers ----
  // Un seul setTimeout calé sur le prochain timer : l'état ne change que lorsqu'un timer expire
  useEffect(() => {
    const ends = tasks
      .map((t) => t.timerEnd)
      .filter((end): end is number => end !== null);
    if (ends.length === 0) return;

    const nextEnd = Math.min(...ends);
    let timeout: ReturnType<typeof setTimeout>;

    const check = () => {
      const now = Date.now();
      const expired = tasks.filter(
        (t) => t.timerEnd !== null && t.timerEnd <= now
      );
      if (expired.length === 0) {
        timeout = setTimeout(check, Math.min(nextEnd - now, MAX_TIMEOUT_MS));
        return;
      }

      const expiredIds = new Set(expired.map((t) => t.id));
      setTasks((prev) =>
        prev.map((t) =>
          expiredIds.has(t.id)
            ? { ...t, timerEnd: null, updatedAt: Date.now() }
            : t
        )
      );
      Alert.alert(
        t.timer.expiredTitle,
        expired.length === 1
          ? t.timer.expiredOne(expired[0].title)
          : t.timer.expiredMany(expired.map((task) => task.title))
      );
    };

    timeout = setTimeout(
      check,
      Math.max(0, Math.min(nextEnd - Date.now(), MAX_TIMEOUT_MS))
    );
    return () => clearTimeout(timeout);
  }, [tasks]);

  // Applique une modification à une seule tâche.
  // updatedAt sert de point de départ aux relances : un report en cours n'a plus lieu d'être.
  const updateOne = (id: string, change: (t: Task) => Task) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const now = Date.now();
        const next = change(t);
        return {
          ...next,
          updatedAt: now,
          snoozedUntil: null,
          categoryChangedAt:
            next.category !== t.category ? now : t.categoryChangedAt,
        };
      })
    );
  };

  const addTask = (input: TaskInput) => {
    const now = Date.now();
    const fields = keepRelevantFields(input.category, {
      ...defaultReminderFields(input.category, settings),
      ...defined(input),
    });
    const newTask: Task = {
      id: newId(now),
      title: input.title,
      category: input.category,
      isDone: false,
      timerEnd: null,
      createdAt: now,
      updatedAt: now,
      categoryChangedAt: now,
      archivedAt: null,
      snoozedUntil: null,
      notificationIds: [],
      completedAt: null,
      priorityWeek: null,
      nextOccurrenceId: null,
      ...fields,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  // Remise à la main dans « Planifier » avec une échéance passée : l'utilisateur l'a voulu,
  // la tâche ne rebascule pas dans « Faire » pour cette échéance
  const keepPlannedIfOverdue = (t: Task): Task =>
    t.category === "INU" && t.dueAt !== null && t.dueAt <= Date.now()
      ? { ...t, escalationSkippedFor: t.dueAt }
      : t;

  // Modifie le titre, le quadrant et/ou les réglages de rappel (fiche, « Annuler » d'un déplacement)
  const updateTask = (id: string, patch: Partial<TaskInput>) => {
    updateOne(id, (t) => {
      const category = patch.category ?? t.category;
      return keepPlannedIfOverdue({
        ...t,
        title: patch.title ?? t.title,
        category,
        ...keepRelevantFields(category, {
          ...pickReminderFields(t),
          ...defined(patch),
        }),
      });
    });
  };

  // Déplace vers un autre quadrant : les rappels reprennent les valeurs par défaut du quadrant
  const movedFields = (t: Task, category: Category): ReminderFields =>
    keepRelevantFields(category, {
      ...defaultReminderFields(category, settingsRef.current),
      dueAt: t.dueAt,
      delegatedTo: t.delegatedTo,
      recurrence: t.recurrence,
      // Une tâche récurrente garde son rappel pour l'occurrence suivante
      ...(t.recurrence && t.reminderOffset !== null ? { reminderOffset: t.reminderOffset } : {}),
    });

  const moveTask = (id: string, category: Category) => {
    updateOne(id, (t) => keepPlannedIfOverdue({ ...t, category, ...movedFields(t, category) }));
  };

  // ---- Bascule automatique des tâches « Planifier » en retard ----
  const [escalation, setEscalation] = useState<Escalation | null>(null);
  // Fait avancer la vérification suivante (délai plafonné à MAX_TIMEOUT_MS)
  const [escalationTick, setEscalationTick] = useState(0);
  // App à l'écran : la minuterie de l'échéance suivante ne tourne pas en arrière-plan
  const [foreground, setForeground] = useState(isForeground(AppState.currentState));

  // Passe en Faire les tâches « Planifier » dont l'échéance est dépassée. Les relances partent
  // de maintenant ; les notifications sont reprogrammées selon la nouvelle catégorie.
  const escalateOverdue = () => {
    if (!settingsRef.current.autoEscalate) return;
    const now = Date.now();
    const overdue = tasksRef.current.filter((t) => shouldEscalate(t, now));
    if (overdue.length === 0) return;
    const ids = new Set(overdue.map((t) => t.id));
    setTasks((prev) =>
      prev.map((t) =>
        ids.has(t.id) && shouldEscalate(t, now)
          ? {
              ...t,
              category: "UI",
              ...movedFields(t, "UI"),
              updatedAt: now,
              categoryChangedAt: now,
              snoozedUntil: null,
            }
          : t
      )
    );
    setEscalation((current) => ({
      at: now,
      // Plusieurs bascules avant « Annuler » : toutes sont annulables
      before: [...(current?.before.filter((t) => !ids.has(t.id)) ?? []), ...overdue],
    }));
  };

  // « Annuler » : les tâches reviennent dans « Planifier » telles qu'elles étaient, et ne
  // rebasculent plus pour cette échéance
  const undoEscalation = () => {
    const before = new Map((escalation?.before ?? []).map((t) => [t.id, t]));
    const now = Date.now();
    setTasks((prev) =>
      prev.map((t) => {
        const old = before.get(t.id);
        if (!old || t.category !== "UI" || t.isDone) return t;
        return {
          ...t,
          category: old.category,
          ...pickReminderFields(old),
          categoryChangedAt: old.categoryChangedAt,
          escalationSkippedFor: old.dueAt,
          updatedAt: now,
          snoozedUntil: null,
        };
      })
    );
    setEscalation(null);
  };

  const dismissEscalation = () => setEscalation(null);

  // Import d'une sauvegarde : tâches et journal remplacés. Toutes les notifications sont
  // ensuite réconciliées, comme au démarrage.
  const replaceAll = ({ tasks: next, completions: log }: { tasks: Task[]; completions: Completion[] }) => {
    syncedRef.current = null;
    idsRef.current = new Map();
    loggedTasksRef.current = null;
    setEscalation(null);
    setTasks(next.map((t) => ({ ...t, notificationIds: [] })));
    setCompletions(pruneLog(log, Date.now()));
  };

  // Au démarrage (réglages lus), au retour dans l'app, à l'heure de l'échéance si l'app est
  // ouverte, et quand le réglage est activé. Rien en arrière-plan.
  useEffect(() => {
    if (!isLoaded || !settingsReady || !settings.autoEscalate || !foreground) return;
    const now = Date.now();
    if (tasks.some((t) => shouldEscalate(t, now))) {
      escalateOverdue();
      return;
    }
    const upcoming = tasks
      .filter((t) => t.category === "INU" && !t.isDone && t.archivedAt === null && t.dueAt !== null)
      .map((t) => t.dueAt!)
      .filter((due) => due > now);
    if (upcoming.length === 0) return;
    const timeout = setTimeout(
      () => setEscalationTick((n) => n + 1),
      Math.min(Math.min(...upcoming) - now + 50, MAX_TIMEOUT_MS)
    );
    return () => clearTimeout(timeout);
  }, [tasks, isLoaded, settingsReady, settings.autoEscalate, escalationTick, foreground]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(isForeground(state));
      // Retour dans l'app : vérification même si l'état n'a pas changé entre-temps
      if (state === "active") setEscalationTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  // Occurrence suivante d'une tâche récurrente : mêmes champs, nouvel identifiant, échéance
  // suivante après maintenant (sans rattrapage), de retour dans « Planifier »
  const nextOccurrenceOf = (task: Task, id: string, now: number): Task => ({
    ...task,
    id,
    category: "INU",
    ...keepRelevantFields("INU", {
      ...pickReminderFields(task),
      reminderOffset: task.reminderOffset ?? settingsRef.current.planReminderOffset,
      dueAt: nextOccurrence(task.recurrence!, task.dueAt!, now),
    }),
    isDone: false,
    completedAt: null,
    timerEnd: null,
    createdAt: now,
    updatedAt: now,
    categoryChangedAt: now,
    archivedAt: null,
    snoozedUntil: null,
    priorityWeek: null,
    nextOccurrenceId: null,
    escalationSkippedFor: null,
    notificationIds: [],
  });

  // Termine une tâche (date de fin pour le bilan). Récurrente : crée l'occurrence suivante.
  const markDone = (id: string) => {
    const now = Date.now();
    const spawnId = newId(now);
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === id);
      const task = prev[index];
      if (!task || task.isDone) return prev;
      const spawn = task.recurrence && task.dueAt !== null ? nextOccurrenceOf(task, spawnId, now) : null;
      const done: Task = {
        ...task,
        isDone: true,
        completedAt: now,
        updatedAt: now,
        snoozedUntil: null,
        nextOccurrenceId: spawn?.id ?? null,
      };
      const next = prev.map((t) => (t.id === id ? done : t));
      if (spawn) next.splice(index + 1, 0, spawn);
      return next;
    });
  };

  // Rouvre une tâche (« Annuler ») : sa date de fin est effacée et l'occurrence qu'elle a
  // créée, si elle n'est pas terminée, est supprimée
  const reopen = (id: string) => {
    const now = Date.now();
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task || !task.isDone) return prev;
      const spawnId = task.nextOccurrenceId;
      return prev
        .filter((t) => !(spawnId && t.id === spawnId && !t.isDone))
        .map((t) =>
          t.id === id
            ? { ...t, isDone: false, completedAt: null, nextOccurrenceId: null, updatedAt: now, snoozedUntil: null }
            : t
        );
    });
  };

  const toggleDone = (id: string) => {
    if (tasksRef.current.find((t) => t.id === id)?.isDone) reopen(id);
    else markDone(id);
  };

  // « Fait » depuis une notification : ne décoche jamais une tâche déjà terminée
  const completeTask = (id: string) => {
    if (tasksRef.current.some((t) => t.id === id && !t.isDone)) markDone(id);
  };

  // « Reporter 1 h » : repousse la prochaine relance sans toucher à updatedAt
  // (le point de départ des relances et leur nombre maximum restent les mêmes)
  const snoozeTask = (id: string, minutes: number = SNOOZE_MINUTES) => {
    setSnoozedUntil(id, Date.now() + minutes * 60 * 1000);
  };

  // Fixe directement le report (sert aussi à annuler un « Reporter 1 h »)
  const setSnoozedUntil = (id: string, until: number | null) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id && !t.isDone ? { ...t, snoozedUntil: until } : t))
    );
  };

  // Retire des tâches et renvoie de quoi les restaurer avec restoreTasks
  const removeTasks = (ids: string[]): RemovedTask[] => {
    const idSet = new Set(ids);
    const removed = tasksRef.current.flatMap((task, index) =>
      idSet.has(task.id) ? [{ task, index }] : []
    );
    setTasks((prev) => prev.filter((t) => !idSet.has(t.id)));
    return removed;
  };

  const removeTask = (id: string) => removeTasks([id]);

  // Remet des tâches supprimées à leur place d'origine
  const restoreTasks = (removed: RemovedTask[]) => {
    setTasks((prev) => {
      const next = [...prev];
      for (const { task, index } of [...removed].sort((a, b) => a.index - b.index)) {
        if (next.some((t) => t.id === task.id)) continue;
        next.splice(Math.min(index, next.length), 0, task);
      }
      return next;
    });
  };

  // Supprime les tâches terminées d'un quadrant
  const clearDone = (category: Category): RemovedTask[] =>
    removeTasks(
      tasksRef.current
        .filter((t) => t.category === category && t.isDone)
        .map((t) => t.id)
    );

  // Sort une tâche des archives ; le délai de 7 jours repart de zéro
  const unarchiveTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, archivedAt: null, categoryChangedAt: Date.now(), updatedAt: Date.now() }
          : t
      )
    );
  };

  // Revue de la semaine : archive une tâche « Si j'ai le temps » sans attendre les 7 jours
  const archiveTask = (id: string) => {
    const now = Date.now();
    setTasks((prev) =>
      prev.map((t) => (t.id === id && t.archivedAt === null ? { ...t, archivedAt: now, updatedAt: now } : t))
    );
  };

  // Priorités de la semaine week : remplacent les priorités encore en cours.
  // updatedAt reste inchangé : il sert de point de départ aux relances.
  const setWeekPriorities = (ids: string[], week: string) => {
    const chosen = new Set(ids);
    const currentWeek = weekKey(Date.now());
    setTasks((prev) =>
      prev.map((t) => {
        if (chosen.has(t.id)) return t.priorityWeek === week ? t : { ...t, priorityWeek: week };
        const active = typeof t.priorityWeek === "string" && t.priorityWeek >= currentWeek;
        return active ? { ...t, priorityWeek: null } : t;
      })
    );
  };

  const startTimer = (id: string, minutes: number) => {
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    updateOne(id, (t) => ({ ...t, timerEnd: endTimestamp }));
  };

  return {
    tasks,
    isLoaded,
    loadError,
    retryLoad,
    completions,
    escalation,
    undoEscalation,
    dismissEscalation,
    replaceAll,
    addTask,
    updateTask,
    moveTask,
    toggleDone,
    completeTask,
    snoozeTask,
    setSnoozedUntil,
    removeTask,
    removeTasks,
    restoreTasks,
    clearDone,
    unarchiveTask,
    archiveTask,
    setWeekPriorities,
    startTimer,
    resyncNotifications: reconcileAll,
  };
}
