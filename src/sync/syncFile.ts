import { BACKUP_APP, ParsedBackup } from "../backup";
import { Completion } from "../completionLog";
import { CATEGORY_KEYS, isRecord } from "../guards";
import { isWeekKey } from "../balance";
import { parseStoredTasks, serializeTasks, TASKS_SCHEMA_VERSION } from "../migrations";
import { parseSettings, SETTINGS_SCHEMA_VERSION, Settings } from "../settings";
import { Category } from "../types";
import { RemovedCompletion, SyncData, Tombstone } from "./merge";

// Fichier synchronisé, dans le dossier caché de l'app sur Google Drive (appDataFolder) :
// « dofirst-sync.json » (l'actuel), plus une copie par jour gardée 5 jours.
//
// Les réglages ne sont pas synchronisés (propres à chaque téléphone) : ceux du dernier téléphone
// qui a écrit sont joints, et servent seulement à un téléphone vide qui récupère tout.

export const SYNC_FILE_NAME = "dofirst-sync.json";
export const COPY_PREFIX = "dofirst-sync-copy-";
export const SYNC_VERSION = 1;

export interface ParsedSyncFile {
  data: SyncData;
  settings: Settings | null;
  writtenAt: number;
}

export type SyncFileResult = { ok: true; file: ParsedSyncFile } | { ok: false; reason: "invalid" | "newer" };

export function buildSyncFile(data: SyncData, settings: Settings | null, now: number): string {
  return JSON.stringify({
    app: BACKUP_APP,
    kind: "sync",
    syncVersion: SYNC_VERSION,
    writtenAt: now,
    // Les identifiants de notifications n'ont de sens que sur ce téléphone
    tasks: JSON.parse(serializeTasks(data.tasks.map((t) => ({ ...t, notificationIds: [] })))),
    deleted: data.deleted,
    completionLog: data.completions,
    removedCompletions: data.removedCompletions,
    reviewWeeks: data.reviewWeeks,
    settings: settings === null ? null : { schemaVersion: SETTINGS_SCHEMA_VERSION, settings },
  });
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const parseCompletions = (v: unknown): Completion[] =>
  Array.isArray(v)
    ? v.filter(
        (c): c is Completion => isRecord(c) && finite(c.date) && CATEGORY_KEYS.includes(c.category as Category)
      ).map((c) => ({ date: c.date, category: c.category }))
    : [];

// Vérifie et lit un fichier synchronisé. Rien n'est écrit ici.
export function parseSyncFile(text: string, now: number = Date.now()): SyncFileResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!isRecord(raw) || raw.app !== BACKUP_APP || raw.kind !== "sync" || !finite(raw.syncVersion)) {
    return { ok: false, reason: "invalid" };
  }
  const tasksVersion = isRecord(raw.tasks) ? raw.tasks.schemaVersion : undefined;
  // Écrit par une version plus récente de l'app : refusé plutôt que mal lu (et jamais écrasé)
  if (raw.syncVersion > SYNC_VERSION || (finite(tasksVersion) && tasksVersion > TASKS_SCHEMA_VERSION)) {
    return { ok: false, reason: "newer" };
  }
  let tasks;
  try {
    tasks = parseStoredTasks(JSON.stringify(raw.tasks), now).tasks.filter((t) => t.title.trim() !== "");
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const deleted: Tombstone[] = Array.isArray(raw.deleted)
    ? raw.deleted
        .filter((d): d is Tombstone => isRecord(d) && typeof d.id === "string" && finite(d.deletedAt))
        .map((d) => ({ id: d.id, deletedAt: d.deletedAt }))
    : [];
  const removedCompletions: RemovedCompletion[] = Array.isArray(raw.removedCompletions)
    ? raw.removedCompletions
        .filter((r): r is RemovedCompletion => isRecord(r) && typeof r.key === "string" && finite(r.removedAt))
        .map((r) => ({ key: r.key, removedAt: r.removedAt }))
    : [];
  return {
    ok: true,
    file: {
      data: {
        tasks: tasks.map((t) => ({ ...t, notificationIds: [] })),
        deleted,
        completions: parseCompletions(raw.completionLog),
        removedCompletions,
        reviewWeeks: Array.isArray(raw.reviewWeeks) ? raw.reviewWeeks.filter(isWeekKey) : [],
      },
      settings: isRecord(raw.settings) ? parseSettings(JSON.stringify(raw.settings)) : null,
      writtenAt: finite(raw.writtenAt) ? raw.writtenAt : now,
    },
  };
}

// Sauvegarde de la 1.5 (point de départ de la synchronisation) : mêmes données, sans suppressions
export function fromLegacyBackup(parsed: Extract<ParsedBackup, { ok: true }>): ParsedSyncFile {
  const { backup } = parsed;
  return {
    data: {
      tasks: backup.tasks,
      deleted: [],
      completions: backup.completions,
      removedCompletions: [],
      reviewWeeks: backup.reviewWeeks,
    },
    settings: backup.settings,
    writtenAt: backup.createdAt,
  };
}
