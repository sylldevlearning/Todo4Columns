import AsyncStorage from "@react-native-async-storage/async-storage";
import { addWeeks, isWeekKey, startOfWeek, weekKey, WeekKey } from "./balance";
import { Task } from "./types";

// Revue de la semaine : priorités de la semaine et suivi des revues faites

// Nombre maximum de priorités choisies pendant la revue
export const MAX_PRIORITIES = 3;

// Semaines où une revue a été faite (« 2026-10-19 »), pour la série « X semaines d'affilée »
export const REVIEW_LOG_KEY = "WEEKLY_REVIEW_LOG";

// Semaine visée par les priorités : la semaine en cours du lundi au jeudi ; à partir du
// vendredi (la revue du dimanche par défaut), la semaine qui commence
export function priorityTargetWeek(now: number): WeekKey {
  const day = new Date(now).getDay(); // 0 = dimanche
  const current = startOfWeek(now);
  return weekKey(day === 0 || day >= 5 ? addWeeks(current, 1) : current);
}

// Étoile visible dès le choix et jusqu'à la fin de la semaine visée, puis retirée d'elle-même
export function isPriority(task: Task, now: number): boolean {
  return (
    !task.isDone &&
    task.archivedAt === null &&
    isWeekKey(task.priorityWeek) &&
    task.priorityWeek >= weekKey(now)
  );
}

// Nombre de semaines d'affilée avec une revue, en remontant depuis la semaine en cours
// (ou la précédente si la revue de cette semaine n'est pas encore faite)
export function reviewStreak(weeks: WeekKey[], now: number): number {
  const done = new Set(weeks);
  let week = startOfWeek(now);
  if (!done.has(weekKey(week))) week = addWeeks(week, -1);
  let streak = 0;
  while (done.has(weekKey(week))) {
    streak++;
    week = addWeeks(week, -1);
  }
  return streak;
}

// Contenu enregistré de WEEKLY_REVIEW_LOG ; absent ou illisible : aucune revue
export function parseReviewWeeksJson(json: string | null): WeekKey[] {
  try {
    const data: unknown = JSON.parse(json ?? "null");
    const weeks = (data as { weeks?: unknown } | null)?.weeks;
    return Array.isArray(weeks) ? weeks.filter(isWeekKey) : [];
  } catch {
    return [];
  }
}

export async function loadReviewWeeks(): Promise<WeekKey[]> {
  return parseReviewWeeksJson(await AsyncStorage.getItem(REVIEW_LOG_KEY));
}

// Enregistre la revue de cette semaine et renvoie la série obtenue
export async function recordReview(now: number): Promise<number> {
  const weeks = await loadReviewWeeks();
  const week = weekKey(now);
  // Un an d'historique suffit pour la série
  const next = [...new Set([...weeks, week])].sort().reverse().slice(0, 60);
  await AsyncStorage.setItem(REVIEW_LOG_KEY, JSON.stringify({ schemaVersion: 1, weeks: next }));
  return reviewStreak(next, now);
}
