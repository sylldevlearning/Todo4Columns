import type { Completion } from "./completionLog";
import { DAY_PATTERN, pad } from "./dates";
import { Category } from "./types";

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

// Semaine désignée par la date locale de son lundi, « 2026-10-19 » : la même quel que soit le
// fuseau horaire (un horodatage de lundi 0 h à Paris n'est pas un lundi 0 h à New York).
// L'ordre alphabétique de ces dates est l'ordre chronologique.
export type WeekKey = string;
export const WEEK_KEY_PATTERN = DAY_PATTERN;

export function weekKey(ts: number): WeekKey {
  const d = new Date(startOfWeek(ts));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const isWeekKey = (v: unknown): v is WeekKey => typeof v === "string" && WEEK_KEY_PATTERN.test(v);

// Tâches terminées entre from (inclus) et to (exclu), par quadrant, d'après le journal
export function countCompleted(log: Completion[], from: number, to: number): Counts {
  const counts = emptyCounts();
  for (const { date, category } of log) {
    if (date >= from && date < to) counts[category]++;
  }
  return counts;
}

// Carte « Ta semaine » : les 7 derniers jours glissants
export const lastSevenDays = (log: Completion[], now: number): Counts =>
  countCompleted(log, now - 7 * DAY_MS, now + 1);

// Semaine en cours, puis les semaines précédentes (de la plus récente à la plus ancienne)
export function weeklyHistory(log: Completion[], now: number, weeks = HISTORY_WEEKS): WeekCounts[] {
  const current = startOfWeek(now);
  return Array.from({ length: weeks + 1 }, (_, i) => {
    const start = addWeeks(current, -i);
    return { start, counts: countCompleted(log, start, addWeeks(start, 1)) };
  });
}

// Part de « Planifier » : les tâches faites avant de devenir urgentes
export const anticipated = (counts: Counts) => counts.INU;
