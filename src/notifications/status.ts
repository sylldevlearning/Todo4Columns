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

// Planifier : échéance dépassée
export function isPastDue(task: Task, now: number): boolean {
  return task.category === "INU" && !task.isDone && task.dueAt !== null && task.dueAt <= now;
}
