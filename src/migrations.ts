import { Category, Task } from "./types";

// Version du format enregistré sous la clé TASKS_4COLS
// v1 : tableau brut de tâches (versions 1.0.x)
// v2 : { schemaVersion: 2, tasks: [...] }
// v3 : même enveloppe, ajout de delegatedTo sur chaque tâche
export const TASKS_SCHEMA_VERSION = 3;

export interface StoredTasks {
  schemaVersion: typeof TASKS_SCHEMA_VERSION;
  tasks: Task[];
}

export interface ParsedTasks {
  tasks: Task[];
  fromVersion: number | null; // null = rien d'enregistré
}

const CATEGORY_KEYS: Category[] = ["UI", "INU", "UDI", "NDNI"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const numberOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// Complète et corrige une tâche lue en stockage : on répare plutôt que de supprimer.
// Seules les entrées qui ne sont pas des objets sont écartées (elles restent dans la sauvegarde brute).
export function normalizeTask(
  raw: unknown,
  index: number,
  now: number
): Task | null {
  if (!isRecord(raw)) return null;

  const id =
    typeof raw.id === "string" && raw.id !== ""
      ? raw.id
      : typeof raw.id === "number"
      ? String(raw.id)
      : `${now}-${index}`;

  const idAsDate = Number(id);
  const createdAt =
    numberOrNull(raw.createdAt) ??
    (Number.isFinite(idAsDate) && idAsDate > 0 ? idAsDate : now);

  return {
    id,
    title: typeof raw.title === "string" ? raw.title : String(raw.title ?? ""),
    category: CATEGORY_KEYS.includes(raw.category as Category)
      ? (raw.category as Category)
      : "UI",
    isDone: raw.isDone === true,
    timerEnd: numberOrNull(raw.timerEnd),
    createdAt,
    updatedAt: numberOrNull(raw.updatedAt) ?? createdAt,
    dueAt: numberOrNull(raw.dueAt),
    reminderOffset: numberOrNull(raw.reminderOffset),
    nagInterval: numberOrNull(raw.nagInterval),
    nagRepeat: raw.nagRepeat === true,
    delegatedTo:
      typeof raw.delegatedTo === "string" && raw.delegatedTo.trim() !== ""
        ? raw.delegatedTo
        : null,
    notificationIds: Array.isArray(raw.notificationIds)
      ? raw.notificationIds.filter((n): n is string => typeof n === "string")
      : [],
  };
}

// Lit le contenu brut de TASKS_4COLS, quel que soit son format, et renvoie des tâches au format courant.
// Lève une erreur si le contenu est illisible : l'appelant doit alors conserver une copie brute.
export function parseStoredTasks(
  json: string | null,
  now: number = Date.now()
): ParsedTasks {
  if (json === null) return { tasks: [], fromVersion: null };

  const data: unknown = JSON.parse(json);

  let rawTasks: unknown[];
  let fromVersion: number;
  if (Array.isArray(data)) {
    rawTasks = data;
    fromVersion = 1;
  } else if (isRecord(data) && Array.isArray(data.tasks)) {
    rawTasks = data.tasks;
    fromVersion =
      typeof data.schemaVersion === "number" ? data.schemaVersion : 2;
  } else {
    throw new Error("Format de tâches inconnu");
  }

  const tasks = rawTasks
    .map((raw, i) => normalizeTask(raw, i, now))
    .filter((t): t is Task => t !== null);

  // Les versions 1.0.x utilisaient Date.now() comme id : deux tâches peuvent partager le même.
  // On les rend uniques pour qu'une suppression ne touche qu'une seule tâche.
  const seen = new Set<string>();
  tasks.forEach((t, i) => {
    if (seen.has(t.id)) t.id = `${t.id}-${i}`;
    seen.add(t.id);
  });
  return { tasks, fromVersion };
}

export function serializeTasks(tasks: Task[]): string {
  const stored: StoredTasks = { schemaVersion: TASKS_SCHEMA_VERSION, tasks };
  return JSON.stringify(stored);
}
