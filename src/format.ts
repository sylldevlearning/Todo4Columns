import { addDays, dayKey, dayStart, pad } from "./dates";
import { t } from "./i18n";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// « Mercredi 22 octobre » / « Wednesday, October 22 »
export function formatToday(now: Date = new Date()): string {
  return capitalize(
    now.toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })
  );
}

// « Ven. 24 oct. · 09:00 » / « Fri Oct 24 · 09:00 AM »
export function formatDue(ts: number): string {
  const d = new Date(ts);
  const weekday = d.toLocaleDateString(t.locale, { weekday: "short" });
  const day = d.toLocaleDateString(t.locale, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });
  return `${capitalize(weekday)} ${day} · ${time}`;
}

// Date courte : « 12 oct. », avec l'année si ce n'est pas l'année en cours (« 12 oct. 2025 »)
export function formatShortDate(ts: number, now: number = Date.now()): string {
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return new Date(ts).toLocaleDateString(t.locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// Jour complet : « vendredi 24 octobre » / « Friday, October 24 »
export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" });
}

// Début de semaine : « 13 oct. » / « Oct 13 »
export function formatWeekStart(ts: number): string {
  return new Date(ts).toLocaleDateString(t.locale, { day: "numeric", month: "short" });
}

// Durée lisible : « 45 min », « 1 h 20 », « 3 h », « 2 j » (« 2 d » en anglais)
// round : "up" pour un délai à venir, "down" pour un temps écoulé
export function formatDuration(ms: number, round: "up" | "down" = "down"): string {
  const minutes = Math.max(round === "up" ? Math.ceil(ms / 60000) : Math.floor(ms / 60000), 0);
  if (minutes < 60) return t.reminders.min(minutes);
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? t.reminders.hours(h) : t.reminders.hoursMinutes(h, m.toString().padStart(2, "0"));
  }
  return t.reminders.days(Math.floor(minutes / (24 * 60)));
}

// Jour d'une étape : « Aujourd'hui », « Demain », sinon « jeu. 30 oct. »
export function dayLabel(day: string, now: number): string {
  const today = dayKey(now);
  if (day === today) return t.steps.dayToday;
  if (day === addDays(today, 1)) return t.steps.dayTomorrow;
  return new Date(dayStart(day)).toLocaleDateString(t.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Temps restant « MM:SS », ou « H:MM:SS » au-delà d'une heure
export function formatRemaining(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
