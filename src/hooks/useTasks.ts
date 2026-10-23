import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { archiveStaleTasks } from "../archive";
import { t } from "../i18n";
import { SNOOZE_MINUTES } from "../notifications/schedule";
import { defaultNotifier, Notifier } from "../notifications/service";
import {
  defaultReminderFields,
  keepRelevantFields,
  pickReminderFields,
} from "../reminders";
import { DEFAULT_SETTINGS, notificationSettingsKey, Settings } from "../settings";
import { loadTasks, saveTasks } from "../storage";
import { Category, ReminderFields, Task } from "../types";

// setTimeout ne gère pas les délais > ~24,8 jours : on plafonne et on revérifie
const MAX_TIMEOUT_MS = 60 * 60 * 1000;
// Les modifications rapprochées (coche puis identifiants de notification…) sont écrites ensemble
export const SAVE_DELAY_MS = 400;

const isForeground = (state: string | null | undefined) =>
  state !== "background" && state !== "inactive";

export interface TaskInput extends Partial<ReminderFields> {
  title: string;
  category: Category;
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

// Tout ce qui influence les notifications d'une tâche (sauf leurs identifiants)
const scheduleSignature = (task: Task) =>
  JSON.stringify({ ...task, notificationIds: undefined });

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

  // Charger les tâches sauvegardées au démarrage
  useEffect(() => {
    (async () => {
      try {
        setTasks(await loadTasks());
        setIsLoaded(true);
      } catch (e) {
        console.warn("Erreur récupération tâches :", e);
      }
    })();
  }, []);

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
      if (!isForeground(state)) flushSave();
    });
    return () => {
      subscription.remove();
      flushSave();
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
      for (const task of changed) {
        const known = idsRef.current.get(task.id) ?? task.notificationIds;
        result[task.id] = await notifier.syncTask(
          { ...task, notificationIds: known },
          settingsRef.current
        );
        idsRef.current.set(task.id, result[task.id]);
      }
      applyIds(result);
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
      ...fields,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  // Modifie le titre, le quadrant et/ou les réglages de rappel
  const updateTask = (id: string, patch: Partial<TaskInput>) => {
    updateOne(id, (t) => {
      const category = patch.category ?? t.category;
      return {
        ...t,
        title: patch.title ?? t.title,
        category,
        ...keepRelevantFields(category, {
          ...pickReminderFields(t),
          ...defined(patch),
        }),
      };
    });
  };

  // Déplace vers un autre quadrant : les rappels reprennent les valeurs par défaut du quadrant
  const moveTask = (id: string, category: Category) => {
    updateOne(id, (t) => ({
      ...t,
      category,
      ...keepRelevantFields(category, {
        ...defaultReminderFields(category, settings),
        dueAt: t.dueAt,
        delegatedTo: t.delegatedTo,
      }),
    }));
  };

  const toggleDone = (id: string) => {
    updateOne(id, (t) => ({ ...t, isDone: !t.isDone }));
  };

  // « Fait » depuis une notification : ne décoche jamais une tâche déjà terminée
  const completeTask = (id: string) => {
    if (tasksRef.current.some((t) => t.id === id && !t.isDone)) {
      updateOne(id, (t) => ({ ...t, isDone: true }));
    }
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

  const startTimer = (id: string, minutes: number) => {
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    updateOne(id, (t) => ({ ...t, timerEnd: endTimestamp }));
  };

  return {
    tasks,
    isLoaded,
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
    startTimer,
    resyncNotifications: reconcileAll,
  };
}
