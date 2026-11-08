import { stepsOf } from "./steps";
import { Task } from "./types";

// Avancement d'une tâche, en pourcentage (1.5) :
// - avec des étapes, calculé : étapes faites / total ;
// - sans étape, réglé à la main de 0 à 100 % par pas de 10 (champ progress, null = jamais réglé).

export const PROGRESS_STEP = 10;
export const PROGRESS_VALUES = Array.from({ length: 100 / PROGRESS_STEP + 1 }, (_, i) => i * PROGRESS_STEP);

// Valeur enregistrée : entier de 0 à 100, ramené au pas de 10 le plus proche ; sinon null
export function parseProgress(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const clamped = Math.min(100, Math.max(0, raw));
  return Math.round(clamped / PROGRESS_STEP) * PROGRESS_STEP;
}

// Avancement affiché : calculé d'après les étapes s'il y en a, sinon la valeur réglée (ou null)
export function taskProgress(task: Pick<Task, "steps" | "progress">): number | null {
  const steps = stepsOf(task);
  if (steps.length > 0) return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  return task.progress ?? null;
}

// Avancement calculé d'après les étapes ? (sinon réglable à la main)
export const isAutoProgress = (task: Pick<Task, "steps">) => stepsOf(task).length > 0;
