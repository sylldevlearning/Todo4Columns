import { addDays, dayKey, dayStart } from "./dates";
import { t } from "./i18n";
import { keepTodayReminder, makeStep } from "./steps";
import { TaskStep } from "./types";

// « Répartir sur plusieurs jours » : séances d'une durée choisie, une par jour, sur des jours
// d'affilée, sur certains jours de la semaine ou à des dates précises

export const MIN_SESSIONS = 2;
export const MAX_SESSIONS = 14;
export const SESSION_MINUTES = [30, 60, 120] as const;

export type SplitMode = "consecutive" | "weekdays" | "dates";

export interface SplitOptions {
  mode?: SplitMode; // « Jours d'affilée » par défaut
  count: number; // nombre de séances (2 à 14) ; « Dates précises » : celui des dates choisies
  minutes: number; // durée par séance
  from: "today" | "tomorrow";
  weekdaysOnly: boolean; // jours d'affilée : week-ends sautés
  weekDays?: number[]; // certains jours de la semaine (0 = dimanche)
  dates?: string[]; // dates précises « 2026-11-12 »
}

const isWeekend = (day: string) => {
  const weekday = new Date(dayStart(day)).getDay();
  return weekday === 0 || weekday === 6;
};

const weekday = (day: string) => new Date(dayStart(day)).getDay();

// Dates précises gardées : à partir d'aujourd'hui, sans doublon, dans l'ordre, 14 au plus
export function chosenDates(dates: string[], now: number): string[] {
  const today = dayKey(now);
  return [...new Set(dates)].filter((d) => d >= today).sort().slice(0, MAX_SESSIONS);
}

// Jours des séances, un par séance, à partir d'aujourd'hui ou de demain
export function sessionDays(options: SplitOptions, now: number): string[] {
  const { count, from, weekdaysOnly, mode = "consecutive" } = options;
  if (mode === "dates") return chosenDates(options.dates ?? [], now);
  const weekDays = options.weekDays ?? [];
  if (mode === "weekdays" && weekDays.length === 0) return [];
  const keep = (day: string) =>
    mode === "weekdays" ? weekDays.includes(weekday(day)) : !weekdaysOnly || !isWeekend(day);
  const days: string[] = [];
  let day = addDays(dayKey(now), from === "today" ? 0 : 1);
  while (days.length < count) {
    if (keep(day)) days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

// « Séance 1/5 · 1 h » … avec un jour chacune. Séance d'aujourd'hui dont 9:00 est passé :
// rappel à l'heure pleine suivante
// Moins de MIN_SESSIONS jours choisis (dates précises, aucun jour de la semaine) : aucune séance.
export function splitSessions(options: SplitOptions, now: number): TaskStep[] {
  const count = Math.max(MIN_SESSIONS, Math.min(MAX_SESSIONS, Math.round(options.count)));
  const days = sessionDays({ ...options, count }, now);
  if (days.length < MIN_SESSIONS) return [];
  return days.map((day, i, all) =>
    keepTodayReminder(
      makeStep(t.steps.session(i + 1, all.length, t.steps.durations[options.minutes] ?? `${options.minutes} min`), day),
      now
    )
  );
}
