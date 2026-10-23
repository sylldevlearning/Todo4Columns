import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  Completion,
  COMPLETION_LOG_KEY,
  COMPLETION_LOG_VERSION,
  parseLogJson,
  seedLog,
} from "./completionLog";
import { parseStoredTasks, serializeTasks, TASKS_SCHEMA_VERSION } from "./migrations";
import { parseReviewWeeksJson, REVIEW_LOG_KEY } from "./review";
import { parseSettings, SETTINGS_KEY, SETTINGS_SCHEMA_VERSION, Settings } from "./settings";
import { STORAGE_KEY } from "./storage";
import { isWeekKey } from "./balance";
import { Category, Task } from "./types";

// Sauvegarde manuelle : un fichier JSON avec les tâches, les réglages, le journal des fins de
// tâches et l'historique des revues. Les tâches gardent leur format enregistré (avec leur
// schemaVersion) : un fichier ancien passe par les migrations existantes.

export const BACKUP_APP = "dofirst";
export const BACKUP_VERSION = 1;
// Copie des données actuelles, écrite juste avant un import
export const PRE_IMPORT_BACKUP_KEY = "BACKUP_BEFORE_IMPORT";

export interface BackupFile {
  app: typeof BACKUP_APP;
  backupVersion: number;
  createdAt: number;
  tasks: unknown; // contenu de TASKS_4COLS : { schemaVersion, tasks }
  settings: unknown; // contenu de SETTINGS : { schemaVersion, settings }
  completionLog: Completion[];
  reviewWeeks: string[];
}

export interface BackupContent {
  createdAt: number;
  tasks: Task[];
  settings: Settings;
  completions: Completion[];
  reviewWeeks: string[];
}

export type ParsedBackup =
  | { ok: true; backup: BackupContent }
  | { ok: false; reason: "invalid" | "newer" };

// « dofirst-sauvegarde-2026-10-23.json »
export function backupFileName(now: number, prefix: string): string {
  const d = new Date(now);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export function buildBackup(content: Omit<BackupContent, "createdAt">, now: number): BackupFile {
  return {
    app: BACKUP_APP,
    backupVersion: BACKUP_VERSION,
    createdAt: now,
    // Les identifiants de notifications n'ont de sens que sur ce téléphone
    tasks: JSON.parse(serializeTasks(content.tasks.map((t) => ({ ...t, notificationIds: [] })))),
    settings: { schemaVersion: SETTINGS_SCHEMA_VERSION, settings: content.settings },
    completionLog: content.completions,
    reviewWeeks: content.reviewWeeks,
  };
}

const CATEGORY_KEYS: Category[] = ["UI", "INU", "UDI", "NDNI"];
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Vérifie et lit un fichier de sauvegarde. Rien n'est écrit ici.
export function parseBackup(json: string, now: number = Date.now()): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!isRecord(data) || data.app !== BACKUP_APP || typeof data.backupVersion !== "number") {
    return { ok: false, reason: "invalid" };
  }
  // Fichier d'une version plus récente de l'app : refusé plutôt que mal lu
  const tasksVersion = isRecord(data.tasks) ? data.tasks.schemaVersion : undefined;
  if (
    data.backupVersion > BACKUP_VERSION ||
    (typeof tasksVersion === "number" && tasksVersion > TASKS_SCHEMA_VERSION)
  ) {
    return { ok: false, reason: "newer" };
  }
  if (!Array.isArray(data.tasks) && !(isRecord(data.tasks) && Array.isArray(data.tasks.tasks))) {
    return { ok: false, reason: "invalid" };
  }

  let tasks: Task[];
  try {
    tasks = parseStoredTasks(JSON.stringify(data.tasks), now).tasks;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  // Sans journal (fichier incomplet) : repris des tâches terminées, comme au premier lancement
  const completions = !Array.isArray(data.completionLog)
    ? seedLog(tasks, now)
    : data.completionLog
        .filter(
        (c): c is Completion =>
          isRecord(c) &&
          typeof c.date === "number" &&
          Number.isFinite(c.date) &&
          CATEGORY_KEYS.includes(c.category as Category)
      );
  const reviewWeeks = Array.isArray(data.reviewWeeks)
    ? data.reviewWeeks.filter(isWeekKey)
    : [];

  return {
    ok: true,
    backup: {
      createdAt: typeof data.createdAt === "number" ? data.createdAt : now,
      tasks: tasks.map((t) => ({ ...t, notificationIds: [] })),
      settings: parseSettings(data.settings === undefined ? null : JSON.stringify(data.settings)),
      completions,
      reviewWeeks,
    },
  };
}

// Copie de secours des données actuelles, telles qu'enregistrées, avant de les remplacer
export async function savePreImportCopy(now: number): Promise<void> {
  const keys = [STORAGE_KEY, SETTINGS_KEY, COMPLETION_LOG_KEY, REVIEW_LOG_KEY];
  const values = await AsyncStorage.multiGet(keys);
  await AsyncStorage.setItem(
    PRE_IMPORT_BACKUP_KEY,
    JSON.stringify({ createdAt: now, data: Object.fromEntries(values) })
  );
}

// Date de la copie de secours (donc du dernier import), ou null s'il n'y en a pas
export async function preImportCopyDate(): Promise<number | null> {
  const json = await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY);
  if (json === null) return null;
  try {
    const createdAt = (JSON.parse(json) as { createdAt?: unknown }).createdAt;
    return typeof createdAt === "number" ? createdAt : 0;
  } catch {
    return 0;
  }
}

// Relit la copie de secours : les données telles qu'elles étaient avant le dernier import.
// Lève une erreur si elle est illisible (rien n'est alors modifié).
export async function readPreImportCopy(now: number = Date.now()): Promise<BackupContent> {
  const json = await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY);
  if (json === null) throw new Error("Aucune copie de secours");
  const { createdAt, data } = JSON.parse(json) as {
    createdAt: number;
    data: Record<string, string | null>;
  };
  const tasks = parseStoredTasks(data[STORAGE_KEY] ?? null, now).tasks;
  const log = data[COMPLETION_LOG_KEY] ?? null;
  return {
    createdAt,
    tasks,
    settings: parseSettings(data[SETTINGS_KEY] ?? null),
    // Sans journal enregistré à l'époque : repris des tâches, comme au premier lancement
    completions: log === null ? seedLog(tasks, now) : parseLogJson(log),
    reviewWeeks: parseReviewWeeksJson(data[REVIEW_LOG_KEY] ?? null),
  };
}

export const removePreImportCopy = () => AsyncStorage.removeItem(PRE_IMPORT_BACKUP_KEY);

// Écrit les données importées (les tâches et le journal sont aussi remplacés en mémoire)
export async function writeImported(backup: BackupContent): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEY, serializeTasks(backup.tasks)],
    [SETTINGS_KEY, JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings: backup.settings })],
    [COMPLETION_LOG_KEY, JSON.stringify({ schemaVersion: COMPLETION_LOG_VERSION, entries: backup.completions })],
    [REVIEW_LOG_KEY, JSON.stringify({ schemaVersion: 1, weeks: backup.reviewWeeks })],
  ]);
}

// Écrit le fichier dans le cache et ouvre le partage natif (Drive, mail, fichiers…)
export async function shareBackupFile(file: BackupFile, name: string, dialogTitle: string): Promise<void> {
  const target = new File(Paths.cache, name);
  target.create({ overwrite: true });
  target.write(JSON.stringify(file, null, 2));
  await Sharing.shareAsync(target.uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle,
  });
}

// Choix d'un fichier dans le sélecteur du système (aucune permission de stockage) ;
// null si l'utilisateur annule. Certains gestionnaires de fichiers donnent au .json un type
// générique : ils sont acceptés, le contenu est vérifié ensuite.
export async function pickBackupText(): Promise<string | null> {
  const picked = await File.pickFileAsync({
    mimeTypes: ["application/json", "text/plain", "application/octet-stream"],
  });
  if (picked.canceled || !picked.result) return null;
  return picked.result.text();
}
