import { t } from "./i18n";
import { Recurrence, RecurrenceFreq } from "./types";

// Tâches récurrentes : calcul de l'échéance suivante, en heure locale.
// Les jours sont avancés par le calendrier (setDate) : l'heure reste la même au changement d'heure.

export const RECURRENCE_FREQS: RecurrenceFreq[] = ["daily", "weekdays", "weekly", "monthly", "yearly"];

// Routines quotidiennes : leur échéance est toujours proche, elles ne sont pas « bientôt urgentes »
export const isRoutine = (rule: Recurrence | null | undefined) =>
  rule?.freq === "daily" || rule?.freq === "weekdays";

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// Complète la règle avec ce qui vient de l'échéance : jours de la semaine, jour du mois, mois.
// Gardés ensuite d'une occurrence à l'autre : un 31 ramené au 30 avril redevient le 31 en mai.
export function withAnchors(rule: Recurrence, dueAt: number): Recurrence {
  const due = new Date(dueAt);
  switch (rule.freq) {
    case "weekly":
      return { freq: "weekly", days: rule.days?.length ? [...rule.days].sort() : [due.getDay()] };
    case "monthly":
      return { freq: "monthly", monthDay: rule.monthDay ?? due.getDate() };
    case "yearly":
      return { freq: "yearly", month: rule.month ?? due.getMonth(), monthDay: rule.monthDay ?? due.getDate() };
    default:
      return { freq: rule.freq };
  }
}

const matchesDay = (rule: Recurrence, day: number, dueDay: number) => {
  if (rule.freq === "weekdays") return day >= 1 && day <= 5;
  if (rule.freq === "weekly") return (rule.days?.length ? rule.days : [dueDay]).includes(day);
  return true;
};

// Échéance suivante : la première occurrence après maintenant ET après l'échéance actuelle.
// Les occurrences manquées ne sont pas rattrapées. L'heure est celle de l'échéance actuelle.
export function nextOccurrence(rule: Recurrence, dueAt: number, now: number): number {
  const due = new Date(dueAt);
  const after = Math.max(dueAt, now);
  const hours = due.getHours();
  const minutes = due.getMinutes();
  const start = new Date(after);

  if (rule.freq === "monthly" || rule.freq === "yearly") {
    const monthDay = rule.monthDay ?? due.getDate();
    for (let i = 0; i < 1200; i++) {
      const year = rule.freq === "yearly" ? start.getFullYear() + i : start.getFullYear();
      const month =
        rule.freq === "yearly" ? rule.month ?? due.getMonth() : start.getMonth() + i;
      // Mois trop court (31, 29 février) : dernier jour du mois
      const candidate = new Date(year, month, 1, hours, minutes, 0, 0);
      candidate.setDate(Math.min(monthDay, daysInMonth(candidate.getFullYear(), candidate.getMonth())));
      if (candidate.getTime() > after) return candidate.getTime();
    }
  } else {
    const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hours, minutes);
    for (let i = 0; i < 8; i++) {
      if (candidate.getTime() > after && matchesDay(rule, candidate.getDay(), due.getDay())) {
        return candidate.getTime();
      }
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(hours, minutes, 0, 0);
    }
  }
  throw new Error("Aucune occurrence trouvée");
}

// Échéance proposée en choisissant une répétition : la prochaine occurrence à 9 h
export function proposedDue(rule: Recurrence, now: number): number {
  const seed = new Date(now);
  seed.setHours(9, 0, 0, 0);
  const anchored = withAnchors(rule, seed.getTime());
  const day = seed.getDay();
  if (seed.getTime() > now && matchesDay(anchored, day, day)) return seed.getTime();
  return nextOccurrence(anchored, seed.getTime(), now);
}

// « Chaque semaine · Lun, Jeu »
export function recurrenceLabel(rule: Recurrence): string {
  if (rule.freq === "weekly" && rule.days?.length) {
    const days = [...rule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    return t.recurrence.weeklyOn(days.map((d) => t.settings.weekdays[d]).join(", "));
  }
  return t.recurrence[rule.freq];
}

// Règle lue en stockage, ou null si elle est invalide
export function parseRecurrence(raw: unknown): Recurrence | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!RECURRENCE_FREQS.includes(r.freq as RecurrenceFreq)) return null;
  const rule: Recurrence = { freq: r.freq as RecurrenceFreq };
  const int = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined;
  if (Array.isArray(r.days)) {
    const days = r.days.filter((d) => int(d, 0, 6) !== undefined) as number[];
    if (days.length > 0) rule.days = [...new Set(days)].sort();
  }
  const monthDay = int(r.monthDay, 1, 31);
  if (monthDay !== undefined) rule.monthDay = monthDay;
  const month = int(r.month, 0, 11);
  if (month !== undefined) rule.month = month;
  return rule;
}
