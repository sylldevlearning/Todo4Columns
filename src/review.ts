import AsyncStorage from "@react-native-async-storage/async-storage";
import { addWeeks, startOfWeek } from "./balance";
import { Task } from "./types";

// Revue de la semaine : priorités de la semaine et suivi des revues faites

// Nombre maximum de priorités choisies pendant la revue
export const MAX_PRIORITIES = 3;

// Semaines où une revue a été faite (lundis 0 h), pour la série « X semaines d'affilée »
export const REVIEW_LOG_KEY = "WEEKLY_REVIEW_LOG";

// Semaine visée par les priorités : la semaine en cours du lundi au jeudi ; à partir du
// vendredi (la revue du dimanche par défaut), la semaine qui commence
export function priorityTargetWeek(now: number): number {
  const day = new Date(now).getDay(); // 0 = dimanche
  const current = startOfWeek(now);
  return day === 0 || day >= 5 ? addWeeks(current, 1) : current;
}

// Étoile visible dès le choix et jusqu'à la fin de la semaine visée, puis retirée d'elle-même
export function isPriority(task: Task, now: number): boolean {
  return (
    !task.isDone &&
    task.archivedAt === null &&
    typeof task.priorityWeek === "number" &&
    task.priorityWeek >= startOfWeek(now)
  );
}

// Nombre de semaines d'affilée avec une revue, en remontant depuis la semaine en cours
// (ou la précédente si la revue de cette semaine n'est pas encore faite)
export function reviewStreak(weeks: number[], now: number): number {
  const done = new Set(weeks);
  let week = startOfWeek(now);
  if (!done.has(week)) week = addWeeks(week, -1);
  let streak = 0;
  while (done.has(week)) {
    streak++;
    week = addWeeks(week, -1);
  }
  return streak;
}

export async function loadReviewWeeks(): Promise<number[]> {
  try {
    const data: unknown = JSON.parse((await AsyncStorage.getItem(REVIEW_LOG_KEY)) ?? "null");
    const weeks = (data as { weeks?: unknown } | null)?.weeks;
    return Array.isArray(weeks) ? weeks.filter((w): w is number => typeof w === "number") : [];
  } catch {
    return [];
  }
}

// Enregistre la revue de cette semaine et renvoie la série obtenue
export async function recordReview(now: number): Promise<number> {
  const weeks = await loadReviewWeeks();
  const week = startOfWeek(now);
  // Un an d'historique suffit pour la série
  const next = [...new Set([...weeks, week])].sort((a, b) => b - a).slice(0, 60);
  await AsyncStorage.setItem(REVIEW_LOG_KEY, JSON.stringify({ schemaVersion: 1, weeks: next }));
  return reviewStreak(next, now);
}
