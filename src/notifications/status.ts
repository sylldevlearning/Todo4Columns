import { isRoutine } from "../recurrence";
import { Settings } from "../settings";
import { Task } from "../types";
import { computeSchedule, ScheduledNotification } from "./schedule";

const MINUTE = 60 * 1000;

// Prochaine relance prévue (Faire, Déléguer, ou rappel reporté), après plage silencieuse
export function nextFollowUp(
  task: Task,
  settings: Settings,
  now: number
): ScheduledNotification | null {
  return (
    computeSchedule(task, settings, now).find(
      (item) => item.type === "nag" || item.type === "delegate" || item.type === "snooze"
    ) ?? null
  );
}

// Faire : en attente depuis plus que son délai de relance (et pas reportée)
export function isWaiting(task: Task, now: number): boolean {
  return (
    task.category === "UI" &&
    !task.isDone &&
    task.archivedAt === null &&
    task.nagInterval !== null &&
    now - task.updatedAt > task.nagInterval * MINUTE &&
    !(task.snoozedUntil !== null && task.snoozedUntil > now)
  );
}

// Échéance proche : en dessous, une tâche « Planifier » devient bientôt urgente
export const SOON_URGENT_MS = 48 * 60 * 60 * 1000;

// Échéance à venir dans moins de 48 h
export const isDueSoon = (dueAt: number, now: number) =>
  dueAt > now && dueAt - now < SOON_URGENT_MS;

// Planifier : échéance dans moins de 48 h (« Bientôt urgente », « Passer en Faire »).
// La notification d'échéance existante reste la seule notification.
export function isSoonUrgent(task: Task, now: number): boolean {
  return (
    task.category === "INU" &&
    !task.isDone &&
    task.archivedAt === null &&
    task.dueAt !== null &&
    // Une tâche répétée chaque jour a toujours son échéance proche : pas d'alerte
    !isRoutine(task.recurrence) &&
    isDueSoon(task.dueAt, now)
  );
}

// En retard : pas terminée et échéance dépassée (puce « En retard »)
export function isLate(task: Task, now: number): boolean {
  return !task.isDone && task.archivedAt === null && task.dueAt !== null && task.dueAt <= now;
}

// Bascule automatique : tâche « Planifier » en retard, sauf si la bascule a été annulée pour
// cette échéance (une nouvelle échéance la réactive)
export function shouldEscalate(task: Task, now: number): boolean {
  return (
    task.category === "INU" &&
    isLate(task, now) &&
    task.escalationSkippedFor !== task.dueAt
  );
}

// Planifier : échéance dépassée
export function isPastDue(task: Task, now: number): boolean {
  return task.category === "INU" && !task.isDone && task.dueAt !== null && task.dueAt <= now;
}
