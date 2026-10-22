import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_REMINDER_FIELDS } from "./reminders";
import { Category, Task } from "./types";

// Récupération des tâches de « Prioritize » 1.0.x, dont on ne connaît ni la clé ni le format.
// Elle ne s'exécute qu'une fois, quand TASKS_4COLS n'existe pas, et ne modifie jamais
// les clés d'origine : elle les lit, convertit ce qui ressemble à des tâches et l'enregistre
// sous TASKS_4COLS.

export const RECOVERY_DONE_KEY = "TASKS_4COLS_RECOVERY_DONE";
export const RECOVERY_LOG_KEY = "TASKS_4COLS_RECOVERY_LOG";

// Clés de l'app : jamais lues comme d'anciennes tâches
const APP_KEY_PREFIXES = ["TASKS_4COLS", "SETTINGS", "LAST_HANDLED_NOTIFICATION_RESPONSE"];
const isAppKey = (key: string) => APP_KEY_PREFIXES.some((p) => key.startsWith(p));

const TEXT_FIELDS = ["title", "text", "name", "task", "label", "content"];
const DONE_FIELDS = ["done", "completed", "isDone", "checked"];
const CATEGORY_FIELDS = ["category", "quadrant", "type", "column", "priority", "cat", "list"];
const DATE_FIELDS = ["createdAt", "date", "id"];
const CATEGORY_KEYS: Category[] = ["UI", "INU", "UDI", "NDNI"];
const DEFAULT_CATEGORY: Category = "INU"; // Planifier
const MAX_DEPTH = 4;

type Raw = Record<string, unknown>;

export interface RecoveryLog {
  date: number;
  scannedKeys: string[];
  imported: { key: string; count: number }[];
  skipped: { key: string; reason: string }[];
}

export interface RecoveryResult {
  tasks: Task[];
  log: RecoveryLog;
}

const isRecord = (v: unknown): v is Raw =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const textOf = (obj: Raw): string | null => {
  for (const field of TEXT_FIELDS) {
    const value = obj[field];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
};

const isTaskLike = (v: unknown): v is Raw => isRecord(v) && textOf(v) !== null;

const isTaskArray = (v: unknown): v is Raw[] =>
  Array.isArray(v) && v.length > 0 && v.every(isTaskLike);

// « urgentNotImportant », « non_urgent-important », « Ni urgent ni important » -> mots en minuscules sans accents
const normalizeLabel = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./:]+/g, " ")
    .trim();

// Reconnaît une catégorie dans un libellé, un nom de clé ou de propriété
export function categoryFromLabel(label: string): Category | null {
  const exact = label.trim().toUpperCase();
  if (CATEGORY_KEYS.includes(exact as Category)) return exact as Category;

  const s = normalizeLabel(label);
  const compact = s.replace(/\s+/g, "");

  // Libellés courts « U-I », « NU-I », « U-NI », « NU-NI »
  const short = /^(n?u)(n?i)$/.exec(compact);
  if (short) {
    return fromFlags(short[1] === "u", short[2] === "i");
  }

  // Numéro de quadrant : « q1 », « quadrant 2 », « 3 »
  const numbered = /^(?:q|quadrant|quad)?\s*([1-4])$/.exec(s) ?? /(?:^|\s)(?:q|quadrant)\s*([1-4])(?:\s|$)/.exec(s);
  if (numbered) return CATEGORY_KEYS[Number(numbered[1]) - 1];

  const urgent = /(non|pas|not|ni|un)\s*urgent/.test(s) ? false : /urgent/.test(s) ? true : null;
  const important = /(non|pas|not|ni|un)\s*important/.test(s)
    ? false
    : /important/.test(s)
      ? true
      : null;
  if (urgent !== null && important !== null) return fromFlags(urgent, important);

  // Actions de la matrice d'Eisenhower, seulement si c'est tout le libellé
  // (« taches a faire » ou « todo » ne désignent pas le quadrant Faire)
  return ACTION_LABELS[s] ?? null;
}

const ACTION_LABELS: Record<string, Category> = {
  faire: "UI",
  "a faire maintenant": "UI",
  do: "UI",
  "do first": "UI",
  "do now": "UI",
  planifier: "INU",
  plan: "INU",
  schedule: "INU",
  decide: "INU",
  deleguer: "UDI",
  delegate: "UDI",
  eliminer: "NDNI",
  eliminate: "NDNI",
  delete: "NDNI",
  drop: "NDNI",
};

function fromFlags(urgent: boolean, important: boolean): Category {
  if (urgent && important) return "UI";
  if (important) return "INU";
  if (urgent) return "UDI";
  return "NDNI";
}

// Catégorie d'un objet : champ de catégorie, puis booléens urgent/important, puis indice du conteneur
function categoryOf(obj: Raw, hints: string[]): Category {
  for (const field of CATEGORY_FIELDS) {
    const value = obj[field];
    if (typeof value === "number" && value >= 1 && value <= 4 && Number.isInteger(value)) {
      return CATEGORY_KEYS[value - 1];
    }
    if (typeof value === "string") {
      const found = categoryFromLabel(value);
      if (found) return found;
    }
  }

  const urgent = obj.urgent ?? obj.isUrgent;
  const important = obj.important ?? obj.isImportant;
  if (typeof urgent === "boolean" && typeof important === "boolean") {
    return fromFlags(urgent, important);
  }

  // Du plus précis (propriété la plus proche) au plus général (clé AsyncStorage)
  for (const hint of hints) {
    const found = categoryFromLabel(hint);
    if (found) return found;
  }
  return DEFAULT_CATEGORY;
}

const MIN_TIMESTAMP = Date.UTC(2000, 0, 1);

// Timestamp en ms depuis un nombre (ms ou s), une chaîne numérique ou une date ISO
function timestampOf(value: unknown, now: number): number | null {
  let n: number | null = null;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") {
    n = /^\d+$/.test(value.trim()) ? Number(value) : Date.parse(value);
  }
  if (n === null || !Number.isFinite(n)) return null;
  if (n > 1e9 && n < 1e10) n *= 1000; // secondes
  return n >= MIN_TIMESTAMP && n <= now + 24 * 60 * 60 * 1000 ? n : null;
}

function createdAtOf(obj: Raw, now: number): number {
  for (const field of DATE_FIELDS) {
    const ts = timestampOf(obj[field], now);
    if (ts !== null) return ts;
  }
  return now;
}

let idCounter = 0;
const recoveredId = (now: number) =>
  `rec-${now.toString(36)}-${(idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function toTask(obj: Raw, hints: string[], now: number): Task {
  const createdAt = createdAtOf(obj, now);
  return {
    id: recoveredId(now),
    title: textOf(obj)!,
    category: categoryOf(obj, hints),
    isDone: DONE_FIELDS.some((f) => obj[f] === true || obj[f] === 1 || obj[f] === "true"),
    timerEnd: null,
    createdAt,
    updatedAt: now,
    categoryChangedAt: now, // pas d'archivage immédiat des tâches « Si j'ai le temps » (NDNI)
    archivedAt: null,
    snoozedUntil: null,
    notificationIds: [],
    // Aucun rappel : on n'envoie pas de notifications pour des tâches importées
    ...EMPTY_REMINDER_FIELDS,
  };
}

// Parcourt une valeur JSON et renvoie les tableaux de tâches trouvés, avec les noms qui y mènent
function findTaskArrays(value: unknown, hints: string[], depth = 0): { items: Raw[]; hints: string[] }[] {
  if (depth > MAX_DEPTH) return [];

  // Valeur JSON imbriquée sous forme de chaîne (ex. redux-persist)
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return [];
    try {
      return findTaskArrays(JSON.parse(trimmed), hints, depth + 1);
    } catch {
      return [];
    }
  }

  if (isTaskArray(value)) return [{ items: value, hints }];

  if (isRecord(value)) {
    return Object.entries(value).flatMap(([prop, child]) =>
      findTaskArrays(child, [prop, ...hints], depth + 1)
    );
  }
  return [];
}

// Convertit les anciennes données trouvées dans AsyncStorage (fonction pure, testable)
export function recoverFromEntries(
  entries: [string, string | null][],
  now: number = Date.now()
): RecoveryResult {
  const log: RecoveryLog = { date: now, scannedKeys: [], imported: [], skipped: [] };
  const tasks: Task[] = [];
  const seen = new Set<string>();

  for (const [key, raw] of entries) {
    if (isAppKey(key)) continue;
    log.scannedKeys.push(key);
    if (raw === null) continue;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      log.skipped.push({ key, reason: "JSON illisible" });
      continue;
    }

    const groups = findTaskArrays(data, [key]);
    if (groups.length === 0) {
      log.skipped.push({ key, reason: "aucune tâche reconnue" });
      continue;
    }

    let count = 0;
    for (const group of groups) {
      for (const obj of group.items) {
        const task = toTask(obj, group.hints, now);
        // La même tâche peut être enregistrée sous plusieurs clés (sauvegardes) : on la garde une fois
        const signature = `${task.title}|${task.category}|${task.isDone}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        tasks.push(task);
        count++;
      }
    }
    log.imported.push({ key, count });
  }

  return { tasks, log };
}

// Récupère les anciennes tâches une seule fois et les enregistre (sous TASKS_4COLS, via save).
// Les clés d'origine ne sont ni modifiées ni supprimées.
export async function recoverLegacyTasks(
  save: (tasks: Task[]) => Promise<void>,
  now: number = Date.now()
): Promise<Task[]> {
  if ((await AsyncStorage.getItem(RECOVERY_DONE_KEY)) !== null) return [];

  const keys = (await AsyncStorage.getAllKeys()).filter((k) => !isAppKey(k));
  const entries = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
  const { tasks, log } = recoverFromEntries(entries as [string, string | null][], now);

  // Les tâches d'abord, le drapeau ensuite : une interruption entre les deux relancera la récupération
  if (tasks.length > 0) await save(tasks);
  await AsyncStorage.setItem(RECOVERY_LOG_KEY, JSON.stringify(log));
  await AsyncStorage.setItem(RECOVERY_DONE_KEY, String(now));

  console.log(
    `Récupération des anciennes tâches : ${tasks.length} importée(s)`,
    JSON.stringify(log)
  );
  return tasks;
}
