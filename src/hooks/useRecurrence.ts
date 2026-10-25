import { Dispatch, MutableRefObject, SetStateAction } from "react";
import { keepRelevantFields, pickReminderFields } from "../reminders";
import { nextOccurrence } from "../recurrence";
import { Settings } from "../settings";
import { Task } from "../types";
import { newId } from "./newId";

// Fin et réouverture des tâches ; une tâche récurrente terminée crée l'occurrence suivante
export function useRecurrence(
  setTasks: Dispatch<SetStateAction<Task[]>>,
  settingsRef: MutableRefObject<Settings>
) {
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

  return { markDone, reopen };
}
