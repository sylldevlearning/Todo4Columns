import { Dispatch, MutableRefObject, SetStateAction } from "react";
import { keepRelevantFields, pickReminderFields } from "../reminders";
import { nextOccurrence } from "../recurrence";
import { Settings } from "../settings";
import { resetSteps, stepsOf } from "../steps";
import { Task } from "../types";

// « r-next-1794211200000 » : identifiant racine de la série (sans les « -next-… » précédents,
// pour qu'il ne s'allonge pas) et échéance de l'occurrence terminée
export const nextOccurrenceId = (task: Task) => `${task.id.split("-next-")[0]}-next-${task.dueAt}`;

// Occurrence suivante d'une tâche récurrente : mêmes champs, nouvel identifiant, échéance
// suivante après maintenant (sans rattrapage), de retour dans « Planifier »
const nextOccurrenceOf = (task: Task, id: string, now: number, settings: Settings): Task => ({
  ...task,
  id,
  category: "INU",
  ...keepRelevantFields("INU", {
    ...pickReminderFields(task),
    reminderOffset: task.reminderOffset ?? settings.planReminderOffset,
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
  // Mêmes étapes, décochées et sans jour prévu
  steps: resetSteps(stepsOf(task)),
  progress: null, // occurrence suivante : rien n'est encore fait
});

// Termine une tâche dans une liste (date de fin pour le bilan). Récurrente : crée l'occurrence
// suivante, avec un identifiant tiré de la tâche d'origine et de l'échéance terminée : deux
// téléphones qui terminent la même occurrence créent la même suivante (une seule après
// synchronisation). Même liste si la tâche n'existe pas ou est déjà terminée.
// Partagée par l'app (useRecurrence) et la coche depuis un widget (src/widgets/complete.ts).
export function markDoneIn(prev: Task[], id: string, now: number, settings: Settings): Task[] {
  const index = prev.findIndex((t) => t.id === id);
  const task = prev[index];
  if (!task || task.isDone) return prev;
  const recurring = task.recurrence && task.dueAt !== null;
  const spawnId = recurring ? nextOccurrenceId(task) : null;
  // Déjà reçue d'un autre téléphone : pas de doublon
  const exists = spawnId !== null && prev.some((t) => t.id === spawnId);
  const spawn = recurring && !exists ? nextOccurrenceOf(task, spawnId!, now, settings) : null;
  const done: Task = {
    ...task,
    isDone: true,
    completedAt: now,
    updatedAt: now,
    snoozedUntil: null,
    nextOccurrenceId: spawnId,
  };
  const next = prev.map((t) => (t.id === id ? done : t));
  if (spawn) next.splice(index + 1, 0, spawn);
  return next;
}

// Fin et réouverture des tâches ; une tâche récurrente terminée crée l'occurrence suivante
export function useRecurrence(
  setTasks: Dispatch<SetStateAction<Task[]>>,
  settingsRef: MutableRefObject<Settings>
) {
  const markDone = (id: string) => {
    const now = Date.now();
    setTasks((prev) => markDoneIn(prev, id, now, settingsRef.current));
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

  return { markDone, reopen };
}
