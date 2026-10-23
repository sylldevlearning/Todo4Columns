import { Category, Task } from "./types";

// Équilibre des tâches terminées entre les 4 quadrants. Semaines du lundi 0 h au lundi suivant,
// en heure locale (calculées par jour du calendrier : le passage à l'heure d'été ne décale rien).

export type Counts = Record<Category, number>;

export interface WeekCounts {
  start: number; // lundi 0 h (timestamp en ms)
  counts: Counts;
}

// En dessous, l'équilibre n'a pas de sens : on invite à terminer quelques tâches
export const MIN_FOR_BALANCE = 3;
// Semaines affichées avant la semaine en cours dans le bilan
export const HISTORY_WEEKS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

const emptyCounts = (): Counts => ({ UI: 0, INU: 0, UDI: 0, NDNI: 0 });

export const totalOf = (counts: Counts) => counts.UI + counts.INU + counts.UDI + counts.NDNI;

// Lundi 0 h de la semaine qui contient ts
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Lundi 0 h, n semaines plus tard (n négatif : plus tôt)
export function addWeeks(weekStart: number, n: number): number {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7 * n);
  return d.getTime();
}

// Tâches terminées entre from (inclus) et to (exclu), par quadrant
export function countCompleted(tasks: Task[], from: number, to: number): Counts {
  const counts = emptyCounts();
  for (const task of tasks) {
    const at = task.completedAt;
    if (task.isDone && typeof at === "number" && at >= from && at < to) counts[task.category]++;
  }
  return counts;
}

// Carte « Ta semaine » : les 7 derniers jours glissants
export const lastSevenDays = (tasks: Task[], now: number): Counts =>
  countCompleted(tasks, now - 7 * DAY_MS, now + 1);

// Semaine en cours, puis les semaines précédentes (de la plus récente à la plus ancienne)
export function weeklyHistory(tasks: Task[], now: number, weeks = HISTORY_WEEKS): WeekCounts[] {
  const current = startOfWeek(now);
  return Array.from({ length: weeks + 1 }, (_, i) => {
    const start = addWeeks(current, -i);
    return { start, counts: countCompleted(tasks, start, addWeeks(start, 1)) };
  });
}

// Part de « Planifier » : les tâches faites avant de devenir urgentes
export const anticipated = (counts: Counts) => counts.INU;
