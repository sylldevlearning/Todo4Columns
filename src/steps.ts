import { addDays, dayKey, isDayKey, isTime } from "./dates";
import { isRecord } from "./guards";
import { Task, TaskStep } from "./types";

// Étapes d'une tâche : jours prévus en date locale « 2026-10-27 », heure « 09:30 »

// Heure du rappel d'une étape sans heure
export const DEFAULT_STEP_TIME = "09:00";

// Identifiant d'étape, unique dans sa tâche
export const newStepId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const stepsOf = (task: Pick<Task, "steps">): TaskStep[] => task.steps ?? [];

// Lit les étapes enregistrées ou importées : on répare plutôt que de supprimer,
// seules les entrées qui ne sont pas des objets sont écartées
export function parseSteps(raw: unknown): TaskStep[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.filter(isRecord).map((s, i) => {
    let id = typeof s.id === "string" && s.id !== "" ? s.id : `s-${i}`;
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    const done = s.done === true;
    return {
      id,
      title: typeof s.title === "string" ? s.title : String(s.title ?? ""),
      done,
      doneAt: done && typeof s.doneAt === "number" && Number.isFinite(s.doneAt) ? s.doneAt : null,
      day: isDayKey(s.day) ? s.day : null,
      time: isTime(s.time) ? s.time : null,
    };
  });
}

export const makeStep = (title: string, day: string | null = null): TaskStep => ({
  id: newStepId(),
  title,
  done: false,
  doneAt: null,
  day,
  time: null,
});

// Progression « 2/5 » ; null sans étapes
export function stepProgress(steps: TaskStep[]): { done: number; total: number } | null {
  if (steps.length === 0) return null;
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

// Étape prévue aujourd'hui et pas encore faite
export const todayStep = (steps: TaskStep[], now: number) =>
  steps.find((s) => !s.done && s.day === dayKey(now)) ?? null;

// Prévue un jour passé et pas faite
export const isStepLate = (step: TaskStep, now: number) =>
  !step.done && step.day !== null && step.day < dayKey(now);

export const lateSteps = (steps: TaskStep[], now: number) => steps.filter((s) => isStepLate(s, now));

// Toutes les étapes sont faites (et il y en a)
export const allStepsDone = (steps: TaskStep[]) => steps.length > 0 && steps.every((s) => s.done);

// Date du rappel d'une étape : son jour, à son heure ou à 9:00 ; null sans jour
export function stepReminderDate(step: TaskStep): number | null {
  if (step.day === null) return null;
  const [h, m] = (step.time ?? DEFAULT_STEP_TIME).split(":").map(Number);
  const [y, mo, d] = step.day.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).getTime();
}

// Déplace l'étape from à la position to
export function moveStep(steps: TaskStep[], from: number, to: number): TaskStep[] {
  if (from === to || from < 0 || from >= steps.length) return steps;
  const target = Math.max(0, Math.min(steps.length - 1, to));
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

// Enregistrement de la fiche : une étape dont la coche n'a pas été touchée dans la fiche reprend
// l'état fait / faitLe du magasin (cochée ailleurs pendant que la fiche était ouverte : rappel, carte)
export function keepStoredChecks(draft: TaskStep[], initial: TaskStep[], stored: TaskStep[]): TaskStep[] {
  const before = new Map(initial.map((s) => [s.id, s]));
  const current = new Map(stored.map((s) => [s.id, s]));
  return draft.map((s) => {
    const was = before.get(s.id);
    const live = current.get(s.id);
    if (!was || !live || was.done !== s.done || was.doneAt !== s.doneAt) return s;
    return live.done === s.done && live.doneAt === s.doneAt ? s : { ...s, done: live.done, doneAt: live.doneAt };
  });
}

// Position mesurée d'une ligne d'étape dans la liste (onLayout)
export interface RowLayout {
  y: number;
  height: number;
}

// Place d'une étape lâchée après un glissement de dy : nombre d'autres lignes dont le milieu est
// au-dessus du milieu de la ligne glissée (lignes de hauteurs différentes comprises)
export function dropIndex(rows: RowLayout[], from: number, dy: number): number {
  const center = rows[from].y + rows[from].height / 2 + dy;
  return rows.filter((r, i) => i !== from && r.y + r.height / 2 < center).length;
}

// Coche ou décoche une étape
export const toggleStepIn = (steps: TaskStep[], id: string, now: number): TaskStep[] =>
  steps.map((s) => (s.id === id ? { ...s, done: !s.done, doneAt: s.done ? null : now } : s));

// « Reporter à demain » : le jour qui suit aujourd'hui
export const postponeStepIn = (steps: TaskStep[], id: string, now: number): TaskStep[] =>
  steps.map((s) => (s.id === id && !s.done ? { ...s, day: addDays(dayKey(now), 1) } : s));

// Occurrence suivante d'une tâche récurrente : mêmes étapes, décochées, sans jour prévu
export const resetSteps = (steps: TaskStep[]): TaskStep[] =>
  steps.map((s) => ({ ...s, done: false, doneAt: null, day: null }));
