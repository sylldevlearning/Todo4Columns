import { addDays, dayKey, dayStart } from "./dates";
import { t } from "./i18n";
import { makeStep } from "./steps";
import { TaskStep } from "./types";

// « Répartir sur plusieurs jours » : séances d'une durée choisie, une par jour

export const MIN_SESSIONS = 2;
export const MAX_SESSIONS = 14;
export const SESSION_MINUTES = [30, 60, 120] as const;

export interface SplitOptions {
  count: number; // nombre de séances (2 à 14)
  minutes: number; // durée par séance
  from: "today" | "tomorrow";
  weekdaysOnly: boolean; // week-ends sautés
}

const isWeekend = (day: string) => {
  const weekday = new Date(dayStart(day)).getDay();
  return weekday === 0 || weekday === 6;
};

// Jours des séances, un par séance, à partir d'aujourd'hui ou de demain
export function sessionDays({ count, from, weekdaysOnly }: SplitOptions, now: number): string[] {
  const days: string[] = [];
  let day = addDays(dayKey(now), from === "today" ? 0 : 1);
  while (days.length < count) {
    if (!weekdaysOnly || !isWeekend(day)) days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

// « Séance 1/5 · 1 h » … avec un jour chacune
export function splitSessions(options: SplitOptions, now: number): TaskStep[] {
  const count = Math.max(MIN_SESSIONS, Math.min(MAX_SESSIONS, Math.round(options.count)));
  return sessionDays({ ...options, count }, now).map((day, i) =>
    makeStep(t.steps.session(i + 1, count, t.steps.durations[options.minutes] ?? `${options.minutes} min`), day)
  );
}
