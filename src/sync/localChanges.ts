import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRecord } from "../guards";
import { Task } from "../types";
import { RemovedCompletion, taskContent, Tombstone, TOMBSTONE_TTL } from "./merge";

// Suivi des modifications locales pour la synchronisation : date de modification de chaque tâche
// (modifiedAt), pierres tombales des tâches supprimées et des entrées retirées du journal (tâche
// rouverte). Tout est noté au moment où ça se produit, jamais déduit plus tard d'un écart : un
// journal pas encore lu ou une écriture perdue ne passe jamais pour une suppression.
// stampChanges est appelée à chaque mise à jour de la liste des tâches (useTasks), et
// noteLogRemoval à chaque entrée retirée du journal (useCompletionLog).

export const TOMBSTONES_KEY = "SYNC_DELETED";

let tombstones = new Map<string, number>();
let logRemovals = new Map<string, number>();
let loaded: Promise<void> | null = null;

const isRemoval = (r: unknown): r is RemovedCompletion =>
  isRecord(r) && typeof r.key === "string" && typeof r.removedAt === "number" && Number.isFinite(r.removedAt);

export function parseLogRemovals(json: string | null): RemovedCompletion[] {
  try {
    const data: unknown = JSON.parse(json ?? "null");
    return isRecord(data) && Array.isArray(data.removedCompletions) ? data.removedCompletions.filter(isRemoval) : [];
  } catch {
    return [];
  }
}

export function parseTombstones(json: string | null): Tombstone[] {
  try {
    const data: unknown = JSON.parse(json ?? "null");
    const list = isRecord(data) && Array.isArray(data.deleted) ? data.deleted : [];
    return list.filter(
      (t): t is Tombstone =>
        isRecord(t) && typeof t.id === "string" && typeof t.deletedAt === "number" && Number.isFinite(t.deletedAt)
    );
  } catch {
    return [];
  }
}

// Pierres tombales enregistrées, lues une seule fois (avant le chargement des tâches)
export function loadTombstones(): Promise<void> {
  loaded ??= AsyncStorage.getItem(TOMBSTONES_KEY)
    .then((json) => {
      // Suppressions faites pendant la lecture : gardées
      const saved = new Map(parseTombstones(json).map((t) => [t.id, t.deletedAt]));
      for (const [id, at] of tombstones) saved.set(id, at);
      tombstones = saved;
      const removals = new Map(parseLogRemovals(json).map((r) => [r.key, r.removedAt]));
      for (const [key, at] of logRemovals) removals.set(key, at);
      logRemovals = removals;
    })
    .catch((e) => console.warn("Lecture des suppressions impossible :", e));
  return loaded;
}

// Écriture des suppressions ; la promesse renvoyée peut être attendue (synchronisation)
export function persistSyncMarks(): Promise<void> {
  const oldest = Date.now() - TOMBSTONE_TTL;
  for (const [id, at] of tombstones) if (at < oldest) tombstones.delete(id);
  for (const [key, at] of logRemovals) if (at < oldest) logRemovals.delete(key);
  return AsyncStorage.setItem(
    TOMBSTONES_KEY,
    JSON.stringify({ schemaVersion: 2, deleted: getTombstones(), removedCompletions: getLogRemovals() })
  ).catch((e) => console.warn("Enregistrement des suppressions impossible :", e));
}
const persist = () => void persistSyncMarks();

export const getTombstones = (): Tombstone[] => [...tombstones].map(([id, deletedAt]) => ({ id, deletedAt }));
export const getLogRemovals = (): RemovedCompletion[] =>
  [...logRemovals].map(([key, removedAt]) => ({ key, removedAt }));

// Entrée retirée du journal (tâche rouverte) ; une entrée remise efface son retrait
export function noteLogRemoval(key: string, now: number): void {
  logRemovals.set(key, now);
  persist();
}
export function noteLogAddition(key: string): void {
  if (logRemovals.delete(key)) persist();
}

// Après une synchronisation : pierres tombales et retraits fusionnés (écriture à attendre)
export function replaceTombstones(list: Tombstone[]): void {
  tombstones = new Map(list.map((t) => [t.id, t.deletedAt]));
}
export function replaceLogRemovals(list: RemovedCompletion[]): void {
  logRemovals = new Map(list.map((r) => [r.key, r.removedAt]));
}

// Tests : tout oublier
export function resetTombstonesForTests(): void {
  tombstones = new Map();
  logRemovals = new Map();
  loaded = null;
}

// Nouvelle liste des tâches après une action de l'utilisateur (ou de l'app : bascule en Faire,
// archivage, récurrence…). Chaque tâche ajoutée ou dont le contenu change reçoit modifiedAt = now,
// sauf si le changement fixe lui-même sa date (changements automatiques : automaticStamp) ;
// changer seulement les identifiants de notifications ou un report ne compte pas. Une tâche retirée laisse
// une pierre tombale ; une tâche remise (« Annuler ») efface la sienne et devient la plus récente.
export function stampChanges(prev: Task[], next: Task[], now: number): Task[] {
  if (prev === next) return next;
  const before = new Map(prev.map((t) => [t.id, t]));
  const after = new Set<string>();
  let changedTombstones = false;
  let changedTasks = false;
  const stamp = (task: Task) => {
    changedTasks = true;
    return { ...task, modifiedAt: now };
  };
  const stamped = next.map((task) => {
    after.add(task.id);
    const old = before.get(task.id);
    if (old === task) return task;
    if (old === undefined) {
      if (tombstones.delete(task.id)) changedTombstones = true;
      return stamp(task);
    }
    if (taskContent(old) === taskContent(task)) return task;
    // Date fixée par le changement lui-même (bascule, archivage, fin du minuteur)
    if (typeof task.modifiedAt === "number" && task.modifiedAt !== old.modifiedAt) {
      changedTasks = true;
      return task;
    }
    return stamp(task);
  });
  for (const id of before.keys()) {
    if (!after.has(id)) {
      tombstones.set(id, now);
      changedTombstones = true;
    }
  }
  if (changedTombstones) persist();
  return changedTasks ? stamped : next;
}
