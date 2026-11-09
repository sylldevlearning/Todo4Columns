import { calendarEntries } from "../calendar";
import { CATEGORIES } from "../constants/categories";
import { dayKey } from "../dates";
import { Category, Task } from "../types";

// Contenu des widgets de l'écran d'accueil (Android), calculé à partir des tâches enregistrées.
// Fonctions pures : le rendu est dans src/widgets/Widgets.tsx.

// Tâches visibles dans la matrice : à faire et non archivées, dans l'ordre de la liste
const open = (tasks: Task[]) => tasks.filter((t) => !t.isDone && t.archivedAt === null);

export interface WidgetTask {
  id: string;
  title: string;
}

export interface QuadrantSummary {
  category: Category;
  count: number;
  tasks: WidgetTask[]; // les premières, dans l'ordre de la case
}

const summary = (tasks: Task[], category: Category, max: number): QuadrantSummary => {
  const inCase = open(tasks).filter((t) => t.category === category);
  return { category, count: inCase.length, tasks: inCase.slice(0, max).map(({ id, title }) => ({ id, title })) };
};

// « Faire » : nombre de tâches et les premières (3 par défaut)
export const doWidgetData = (tasks: Task[], max = 3): QuadrantSummary => summary(tasks, "UI", max);

// « Matrice » : les 4 cases, dans l'ordre de la grille, avec leurs premières tâches
export const matrixWidgetData = (tasks: Task[], max = 3): QuadrantSummary[] =>
  CATEGORIES.map((c) => summary(tasks, c.key, max));

// Une ligne de « Aujourd'hui » : échéance du jour ou étape prévue ce jour, pas encore faite
export interface TodayItem {
  key: string;
  taskId: string;
  stepId: string | null; // étape prévue (cocher la ligne coche l'étape)
  title: string; // titre de la tâche, ou de l'étape
  taskTitle: string | null; // pour une étape : titre de sa tâche
  category: Category;
  time: string | null; // « 14:30 », ou null si l'heure n'est pas renseignée
}

// « Aujourd'hui » : échéances et étapes prévues aujourd'hui, à faire, par heure (sans heure à la fin).
// Les occurrences futures des tâches récurrentes (calculées) n'y sont pas : elles ne sont pas encore
// des tâches.
export function todayWidgetData(tasks: Task[], now: number): TodayItem[] {
  const today = dayKey(now);
  const entries = calendarEntries(tasks, today, today).get(today) ?? [];
  return entries
    .filter((e) => e.kind !== "planned" && !e.done)
    .map((e) => {
      const stepId = e.kind === "step" ? e.key.slice(`step-${e.taskId}-`.length) : null;
      return {
        key: e.key,
        taskId: e.taskId,
        stepId,
        title: e.stepTitle ?? e.title,
        taskTitle: e.stepTitle === null ? null : e.title,
        category: e.category,
        // Une échéance a toujours une heure ; une étape seulement si elle est renseignée
        time: e.time,
      };
    });
}

// Prochain minuit local (rafraîchissement de « Aujourd'hui »)
export function nextMidnight(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}
