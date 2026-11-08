import { addDays, dayKey, dayStart, hhmm, pad } from "./dates";
import { Language } from "./i18n";
import { nextOccurrence, withAnchors } from "./recurrence";
import { stepsOf } from "./steps";
import { Category, Task } from "./types";

// Vue calendrier : calculs purs (grille du mois, contenu des jours, frise horaire).

// Premier jour de la semaine selon la langue de l'app (données CLDR du pays principal) :
// dimanche aux États-Unis, au Brésil, au Japon, en Corée, en Inde et en Indonésie, lundi ailleurs.
const SUNDAY_FIRST: Language[] = ["en", "pt-BR", "ja", "ko", "hi", "id"];
export const weekStartFor = (language: Language): 0 | 1 => (SUNDAY_FIRST.includes(language) ? 0 : 1);

// « 2026-11 » : année et mois (0 = janvier) d'une clé de mois
export interface MonthRef {
  year: number;
  month: number;
}
export const monthOf = (day: string): MonthRef => ({
  year: Number(day.slice(0, 4)),
  month: Number(day.slice(5, 7)) - 1,
});
export const addMonths = ({ year, month }: MonthRef, n: number): MonthRef => {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};
const firstDay = ({ year, month }: MonthRef) => `${year}-${pad(month + 1)}-01`;

// Grille du mois : 6 semaines de 7 jours (clés « 2026-11-02 »), en commençant par le premier jour de
// la semaine. Les jours des mois voisins complètent les semaines.
export function monthGrid(ref: MonthRef, weekStart: 0 | 1): string[] {
  const first = firstDay(ref);
  const lead = (new Date(ref.year, ref.month, 1).getDay() - weekStart + 7) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// Une ligne du calendrier
export type EntryKind = "due" | "step" | "planned";
export interface CalendarEntry {
  key: string; // unique dans la journée
  taskId: string;
  title: string; // titre de la tâche
  stepTitle: string | null; // étape prévue ce jour
  category: Category;
  time: string | null; // « 14:30 », ou null (sans heure)
  kind: EntryKind; // « planned » : occurrence future d'une tâche récurrente, non modifiable
  done: boolean;
}

// Nombre maximal d'occurrences futures calculées par tâche et par plage (un mois : 31 au plus)
const MAX_PLANNED = 62;

// Contenu des jours de la plage [from, to] (clés de jour incluses), trié par heure ; les tâches
// archivées sont exclues.
export function calendarEntries(tasks: Task[], from: string, to: string): Map<string, CalendarEntry[]> {
  const start = dayStart(from);
  const end = dayStart(addDays(to, 1)) - 1;
  const byDay = new Map<string, CalendarEntry[]>();
  const push = (day: string, entry: CalendarEntry) => {
    const list = byDay.get(day);
    if (list) list.push(entry);
    else byDay.set(day, [entry]);
  };

  for (const task of tasks) {
    if (task.archivedAt !== null) continue;
    const base = { taskId: task.id, title: task.title, category: task.category };

    // Échéance (la prochaine occurrence réelle, pour une tâche récurrente)
    if (task.dueAt !== null && task.dueAt >= start && task.dueAt <= end) {
      push(dayKey(task.dueAt), {
        ...base,
        key: `due-${task.id}`,
        stepTitle: null,
        time: hhmm(task.dueAt),
        kind: "due",
        done: task.isDone,
      });
    }

    // Étapes prévues
    for (const step of stepsOf(task)) {
      if (step.day === null || step.day < from || step.day > to) continue;
      push(step.day, {
        ...base,
        key: `step-${task.id}-${step.id}`,
        stepTitle: step.title,
        time: step.time,
        kind: "step",
        done: task.isDone || step.done,
      });
    }

    // Occurrences futures d'une tâche récurrente encore à faire (calculées, pas enregistrées)
    if (task.recurrence && task.dueAt !== null && !task.isDone) {
      const rule = withAnchors(task.recurrence, task.dueAt);
      let after = Math.max(task.dueAt, start - 1);
      for (let i = 0; i < MAX_PLANNED; i++) {
        let next: number;
        try {
          next = nextOccurrence(rule, task.dueAt, after);
        } catch {
          break;
        }
        if (next > end) break;
        push(dayKey(next), {
          ...base,
          key: `planned-${task.id}-${next}`,
          stepTitle: null,
          time: hhmm(next),
          kind: "planned",
          done: false,
        });
        after = next;
      }
    }
  }

  for (const list of byDay.values()) list.sort(compareEntries);
  return byDay;
}

// Par heure (sans heure en dernier), puis à faire avant fait, puis par titre
function compareEntries(a: CalendarEntry, b: CalendarEntry): number {
  if (a.time !== b.time) {
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time < b.time ? -1 : 1;
  }
  if (a.done !== b.done) return a.done ? 1 : -1;
  return a.title.localeCompare(b.title);
}

const CATEGORY_ORDER: Category[] = ["UI", "INU", "UDI", "NDNI"];

// Résumé d'un jour : nombre de lignes et quadrants présents (pour les points de couleur)
export function daySummary(entries: CalendarEntry[] | undefined): { count: number; categories: Category[] } {
  if (!entries?.length) return { count: 0, categories: [] };
  const present = new Set(entries.map((e) => e.category));
  return { count: entries.length, categories: CATEGORY_ORDER.filter((c) => present.has(c)) };
}

// Répartition par quadrant (panneau du jour)
export function byCategory(entries: CalendarEntry[]): { category: Category; count: number }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    count: entries.filter((e) => e.category === category).length,
  })).filter((c) => c.count > 0);
}

// Frise horaire : blocs placés selon l'heure, en colonnes quand ils se chevauchent.
// Une ligne occupe BLOCK_MINUTES sur la frise.
export const BLOCK_MINUTES = 45;
export interface TimelineBlock {
  entry: CalendarEntry;
  minutes: number; // depuis minuit
  column: number;
  columns: number; // colonnes du groupe de blocs qui se chevauchent
}
export interface Timeline {
  startHour: number; // première heure affichée
  endHour: number; // heure de fin (exclue)
  blocks: TimelineBlock[];
  untimed: CalendarEntry[]; // « Sans heure »
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function dayTimeline(entries: CalendarEntry[]): Timeline {
  const timed = entries.filter((e) => e.time !== null);
  const untimed = entries.filter((e) => e.time === null);
  const minutes = timed.map((e) => toMinutes(e.time!));
  // Journée type 8 h – 20 h, élargie aux tâches plus tôt ou plus tard
  const startHour = Math.min(8, ...minutes.map((m) => Math.floor(m / 60)));
  const endHour = Math.max(20, ...minutes.map((m) => Math.min(24, Math.ceil((m + BLOCK_MINUTES) / 60))));

  const blocks: TimelineBlock[] = [];
  // Groupes de blocs qui se chevauchent : colonnes attribuées dans l'ordre
  let group: TimelineBlock[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    const columns = Math.max(1, ...group.map((b) => b.column + 1));
    for (const b of group) b.columns = columns;
    group = [];
  };
  timed.forEach((entry, i) => {
    const m = minutes[i];
    if (m >= groupEnd) closeGroup();
    const used = new Set(group.filter((b) => b.minutes + BLOCK_MINUTES > m).map((b) => b.column));
    let column = 0;
    while (used.has(column)) column++;
    const block = { entry, minutes: m, column, columns: 1 };
    group.push(block);
    blocks.push(block);
    groupEnd = Math.max(groupEnd, m + BLOCK_MINUTES);
  });
  closeGroup();
  return { startHour, endHour, blocks, untimed };
}
