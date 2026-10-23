import AsyncStorage from "@react-native-async-storage/async-storage";
import { addWeeks, startOfWeek } from "./balance";
import { Category, Task } from "./types";

// Journal des fins de tâches : la date et le quadrant de chaque tâche terminée, sans titre.
// Le bilan le lit : supprimer une tâche terminée ou vider les terminées ne le change pas.
export const COMPLETION_LOG_KEY = "COMPLETION_LOG";
export const COMPLETION_LOG_VERSION = 1;
// Semaines gardées, semaine en cours comprise
export const LOG_WEEKS = 26;

export interface Completion {
  date: number; // timestamp en ms
  category: Category;
}

const CATEGORY_KEYS: Category[] = ["UI", "INU", "UDI", "NDNI"];

const isCompletion = (v: unknown): v is Completion =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as Completion).date === "number" &&
  Number.isFinite((v as Completion).date) &&
  CATEGORY_KEYS.includes((v as Completion).category);

// Ne garde que les 26 dernières semaines, dans l'ordre chronologique
export function pruneLog(log: Completion[], now: number): Completion[] {
  const oldest = addWeeks(startOfWeek(now), -(LOG_WEEKS - 1));
  const kept = log.filter((c) => c.date >= oldest);
  return kept.length === log.length && kept.every((c, i) => i === 0 || kept[i - 1].date <= c.date)
    ? log
    : kept.sort((a, b) => a.date - b.date);
}

// Remplissage initial : les tâches déjà terminées dont la date de fin est connue
export const seedLog = (tasks: Task[], now: number): Completion[] =>
  pruneLog(
    tasks.flatMap((t) =>
      t.isDone && typeof t.completedAt === "number"
        ? [{ date: t.completedAt, category: t.category }]
        : []
    ),
    now
  );

// Journal enregistré, ou null s'il n'a encore jamais été écrit (premier lancement)
export async function loadLog(): Promise<Completion[] | null> {
  const json = await AsyncStorage.getItem(COMPLETION_LOG_KEY);
  if (json === null) return null;
  try {
    const entries = (JSON.parse(json) as { entries?: unknown } | null)?.entries;
    return Array.isArray(entries) ? entries.filter(isCompletion) : [];
  } catch {
    return [];
  }
}

export async function saveLog(log: Completion[]): Promise<void> {
  await AsyncStorage.setItem(
    COMPLETION_LOG_KEY,
    JSON.stringify({ schemaVersion: COMPLETION_LOG_VERSION, entries: log })
  );
}

// Met le journal à jour d'après les tâches modifiées : une tâche qui vient d'être terminée
// ajoute une entrée, une tâche rouverte (« Annuler ») retire la sienne. Les tâches ajoutées
// ou supprimées ne changent rien (une tâche restaurée est déjà dans le journal).
export function updateLog(log: Completion[], previous: Task[], next: Task[]): Completion[] {
  const before = new Map(previous.map((t) => [t.id, t]));
  let result = log;
  for (const task of next) {
    const old = before.get(task.id);
    if (!old) continue;
    const was = typeof old.completedAt === "number" ? old.completedAt : null;
    const now = typeof task.completedAt === "number" ? task.completedAt : null;
    if (was === now) continue;
    if (was !== null) {
      const index = result.findIndex((c) => c.date === was);
      if (index !== -1) result = [...result.slice(0, index), ...result.slice(index + 1)];
    }
    if (now !== null) result = [...result, { date: now, category: task.category }];
  }
  return result;
}
