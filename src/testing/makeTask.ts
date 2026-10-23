import { Task } from "../types";

// Tâche complète pour les tests, à surcharger au besoin
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Tâche",
    category: "UI",
    isDone: false,
    timerEnd: null,
    createdAt: 1,
    updatedAt: 1,
    categoryChangedAt: 1,
    archivedAt: null,
    snoozedUntil: null,
    dueAt: null,
    reminderOffset: null,
    nagInterval: null,
    nagRepeat: false,
    delegatedTo: null,
    notificationIds: [],
    completedAt: null,
    priorityWeek: null,
    recurrence: null,
    nextOccurrenceId: null,
    ...overrides,
  };
}
