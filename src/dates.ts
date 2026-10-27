// Dates et heures locales enregistrées : jours « 2026-10-27 », heures « 09:30 »

export const pad = (n: number) => n.toString().padStart(2, "0");

// Heure « HH:MM » (00:00 à 23:59)
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Jour « AAAA-MM-JJ » (semaines du bilan, jours prévus des étapes)
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isTime = (v: unknown): v is string => typeof v === "string" && TIME_PATTERN.test(v);

// Heure locale d'un timestamp, « 09:30 »
export const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Jour local d'un timestamp
export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Minuit local du jour
export const dayStart = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

// Jour décalé de n jours (calendrier local : sans souci de changement d'heure)
export const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n).getTime());
};

// Jour qui existe vraiment (pas de 30 février)
export const isDayKey = (v: unknown): v is string =>
  typeof v === "string" && DAY_PATTERN.test(v) && dayKey(dayStart(v)) === v;
