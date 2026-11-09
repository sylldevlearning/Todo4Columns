import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { archiveStaleTasks } from "../archive";
import { weekKey } from "../balance";
import { Completion } from "../completionLog";
import { SNOOZE_MINUTES } from "../notifications/schedule";
import { defaultNotifier, Notifier } from "../notifications/service";
import {
  defaultReminderFields,
  keepRelevantFields,
  pickReminderFields,
} from "../reminders";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { loadTasks, saveTasks } from "../storage";
import {
  getLogRemovals,
  getTombstones,
  loadTombstones,
  persistSyncMarks,
  replaceLogRemovals,
  replaceTombstones,
  stampChanges,
} from "../sync/localChanges";
import { waitForFirstSync } from "../sync/firstSync";
import { EMPTY_SYNC_DATA, mergeData, modifiedAtOf, SyncData, taskContent } from "../sync/merge";
import { Category, ReminderFields, Task, TaskStep } from "../types";
import { newId } from "./newId";
import { useCompletionLog } from "./useCompletionLog";
import { useEscalation } from "./useEscalation";
import { useForeground } from "./useForeground";
import { useNotificationSync } from "./useNotificationSync";
import { useRecurrence } from "./useRecurrence";
import { useSteps } from "./useSteps";
import { useTaskSaving } from "./useTaskSaving";
import { useTimers } from "./useTimers";

export { SAVE_DELAY_MS } from "./batching";
export type { Escalation } from "./useEscalation";

export interface TaskInput extends Partial<ReminderFields> {
  title: string;
  category: Category;
  steps?: TaskStep[]; // étapes de la fiche
  progress?: number | null; // avancement réglé à la main (sans étapes)
}

// Tâche retirée de la liste, avec sa position pour pouvoir l'annuler
export interface RemovedTask {
  task: Task;
  index: number;
}

// Supprime les clés à undefined pour qu'elles n'écrasent rien lors d'un spread
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

// État des tâches et actions. Le détail est dans des hooks dédiés : journal des fins de tâches,
// sauvegarde, notifications, minuteurs, bascule des tâches en retard, récurrence, étapes.
// settingsReady : réglages enregistrés lus ; aucune notification n'est programmée avant
export function useTasks(
  settings: Settings = DEFAULT_SETTINGS,
  notifier: Notifier = defaultNotifier,
  settingsReady: boolean = true
) {
  const [tasks, setTasksState] = useState<Task[]>([]);
  // Toute modification de la liste passe par ici : date de modification et pierres tombales
  // tenues à jour pour la synchronisation (src/sync/localChanges.ts). Le chargement et les
  // données reçues d'une synchronisation passent directement par setTasksState.
  const setTasks: Dispatch<SetStateAction<Task[]>> = useCallback(
    (action) =>
      setTasksState((prev) => stampChanges(prev, typeof action === "function" ? action(prev) : action, Date.now())),
    []
  );
  // Empêche la sauvegarde tant que les tâches n'ont pas été chargées.
  // Si la lecture échoue, il reste à false : on ne risque pas d'écraser les données existantes.
  const [isLoaded, setIsLoaded] = useState(false);
  // Lecture impossible : l'app affiche un message et bloque la saisie (rien ne serait enregistré)
  const [loadError, setLoadError] = useState(false);
  // App à l'écran : les minuteries (fin d'un minuteur, échéance suivante) ne tournent pas en
  // arrière-plan ; tout est revérifié au retour
  const foreground = useForeground();
  // Dernière liste rendue, pour connaître la position des tâches supprimées
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const { completions, logReady, loadCompletions, replaceCompletions, mergeCompletions } = useCompletionLog(
    tasks,
    isLoaded
  );

  // Charger les tâches sauvegardées (au démarrage, ou « Réessayer » après une erreur), puis le
  // journal des fins de tâches
  const load = () => {
    (async () => {
      let loaded: Task[];
      try {
        await loadTombstones();
        loaded = await loadTasks();
        setTasksState(loaded);
        setIsLoaded(true);
        setLoadError(false);
      } catch (e) {
        console.warn("Erreur récupération tâches :", e);
        setLoadError(true);
        return;
      }
      await loadCompletions(loaded);
    })();
  };

  useEffect(load, []);

  const retryLoad = () => {
    if (!isLoaded) load();
  };

  useTaskSaving(tasks, isLoaded);

  const { reconcileAll, resetSync } = useNotificationSync({
    tasks,
    setTasks,
    tasksRef,
    settings,
    settingsRef,
    isLoaded,
    settingsReady,
    notifier,
  });

  // Option activée : archive les tâches « Si j'ai le temps » restées 7 jours,
  // au chargement puis dès que l'option est cochée. Désactivée, rien n'est archivé
  // et les tâches déjà archivées le restent.
  // Compte Google Drive connecté : l'archivage du lancement attend la première synchronisation
  // (les versions reçues des autres téléphones passent avant).
  useEffect(() => {
    if (!isLoaded || !settings.autoArchive) return;
    let cancelled = false;
    void waitForFirstSync().then(() => {
      if (!cancelled) setTasks((prev) => archiveStaleTasks(prev, Date.now()));
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, settings.autoArchive]);

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

  const { startTimer } = useTimers(tasks, setTasks, foreground, updateOne);

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
      steps: input.steps ?? [],
      progress: input.progress ?? null,
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
        ...(patch.steps ? { steps: patch.steps } : {}),
        ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
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

  const { escalation, undoEscalation, dismissEscalation } = useEscalation({
    tasks,
    tasksRef,
    setTasks,
    settings,
    settingsRef,
    isLoaded,
    settingsReady,
    foreground,
    movedFields,
  });

  // Import d'une sauvegarde : tâches et journal remplacés. Toutes les notifications sont
  // ensuite réconciliées, comme au démarrage. Pour la synchronisation, c'est une modification
  // comme une autre : les tâches retirées sont supprimées des autres téléphones.
  const replaceAll = ({ tasks: next, completions: log }: { tasks: Task[]; completions: Completion[] }) => {
    resetSync();
    dismissEscalation();
    // Une tâche importée modifiée devient la plus récente (date du fichier ignorée) ; inchangée,
    // elle garde sa date
    const current = new Map(tasksRef.current.map((t) => [t.id, t]));
    setTasks(
      next.map((t) => {
        const old = current.get(t.id);
        const same = old !== undefined && taskContent(old) === taskContent(t);
        return { ...t, notificationIds: [], modifiedAt: same ? old.modifiedAt : undefined };
      })
    );
    replaceCompletions(log);
  };

  // Données reçues d'une synchronisation. Fusionnées avec la liste actuelle (rien de ce qui a
  // changé pendant l'échange n'est perdu), ou la remplacent (« Remplacer par Google Drive »).
  // Les tâches inchangées restent les mêmes objets ; les notifications des tâches modifiées,
  // ajoutées ou supprimées sont reprogrammées comme après une modification (useNotificationSync).
  // Les bandeaux « Annuler » restent valables : ils agissent sur la tâche telle qu'elle est.
  // Les données obtenues (tâches, journal, suppressions) sont écrites avant que la promesse se
  // résolve : la synchronisation n'enregistre son état qu'ensuite, et une app tuée entre les deux
  // ne perd rien.
  const applySynced = async (
    data: SyncData,
    { replace = false }: { replace?: boolean } = {}
  ): Promise<{ tasks: Task[]; completions: Completion[] }> => {
    const now = Date.now();
    // Suppressions des deux côtés (une suppression faite ici pendant l'échange est gardée),
    // sauf celles d'une tâche modifiée depuis, revenue
    const received = new Map(data.tasks.map((t) => [t.id, modifiedAtOf(t)]));
    const marks = replace
      ? { deleted: data.deleted, removedCompletions: data.removedCompletions }
      : mergeData(
          { ...EMPTY_SYNC_DATA, deleted: getTombstones(), removedCompletions: getLogRemovals() },
          { ...EMPTY_SYNC_DATA, deleted: data.deleted, removedCompletions: data.removedCompletions },
          now
        );
    const deleted = replace
      ? marks.deleted
      : marks.deleted.filter((t) => (received.get(t.id) ?? -Infinity) <= t.deletedAt);
    replaceTombstones(deleted);
    replaceLogRemovals(marks.removedCompletions);
    const compute = (prev: Task[]): Task[] => {
      if (replace) {
        const mine = new Map(prev.map((t) => [t.id, t]));
        return data.tasks.map((t) => {
          const old = mine.get(t.id);
          if (!old) return { ...t, notificationIds: [], snoozedUntil: null };
          return taskContent(old) === taskContent(t) && old.modifiedAt === t.modifiedAt
            ? old
            : { ...t, notificationIds: old.notificationIds, snoozedUntil: old.snoozedUntil };
        });
      }
      return mergeData({ ...EMPTY_SYNC_DATA, tasks: prev, deleted }, data, now).tasks;
    };
    const nextTasks = compute(tasksRef.current);
    setTasksState(compute);
    const [, nextLog] = await Promise.all([
      saveTasks(nextTasks),
      mergeCompletions(data.completions, marks.removedCompletions, replace),
      persistSyncMarks(),
    ]);
    return { tasks: nextTasks, completions: nextLog };
  };

  const { markDone, reopen } = useRecurrence(setTasks, settingsRef);
  const { toggleStep, completeStep, postponeStep } = useSteps(setTasks);

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

  return {
    tasks,
    isLoaded,
    logReady,
    loadError,
    retryLoad,
    completions,
    escalation,
    undoEscalation,
    dismissEscalation,
    replaceAll,
    applySynced,
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
    toggleStep,
    completeStep,
    postponeStep,
    resyncNotifications: reconcileAll,
  };
}
