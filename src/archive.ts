import { Task } from "./types";

// Une tâche « Éliminer » non terminée est archivée après 7 jours dans ce quadrant
export const ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const isArchived = (task: Task) => task.archivedAt !== null;

export function shouldArchive(task: Task, now: number): boolean {
  return (
    task.category === "NDNI" &&
    !task.isDone &&
    task.archivedAt === null &&
    now - task.categoryChangedAt >= ARCHIVE_AFTER_MS
  );
}

// Renvoie la liste avec les tâches à archiver marquées (même tableau si rien ne change)
export function archiveStaleTasks(tasks: Task[], now: number): Task[] {
  if (!tasks.some((t) => shouldArchive(t, now))) return tasks;
  return tasks.map((t) =>
    shouldArchive(t, now) ? { ...t, archivedAt: now, updatedAt: now } : t
  );
}
