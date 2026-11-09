import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRecord } from "../guards";
import { Task } from "../types";
import { taskContent, Tombstone, TOMBSTONE_TTL } from "./merge";

// Suivi des modifications locales pour la synchronisation : date de modification de chaque tâche
// (modifiedAt) et pierres tombales des tâches supprimées. Tout passe par stampChanges, appelée à
// chaque mise à jour de la liste des tâches (useTasks) : aucune action ne peut l'oublier.

export const TOMBSTONES_KEY = "SYNC_DELETED";

let tombstones = new Map<string, number>();
let loaded: Promise<void> | null = null;

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
    })
    .catch((e) => console.warn("Lecture des suppressions impossible :", e));
  return loaded;
}

function persist() {
  const now = Date.now();
  for (const [id, at] of tombstones) if (at < now - TOMBSTONE_TTL) tombstones.delete(id);
  AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify({ schemaVersion: 1, deleted: getTombstones() })).catch((e) =>
    console.warn("Enregistrement des suppressions impossible :", e)
  );
}

export const getTombstones = (): Tombstone[] => [...tombstones].map(([id, deletedAt]) => ({ id, deletedAt }));

// Après une synchronisation : pierres tombales fusionnées
export function replaceTombstones(list: Tombstone[]): void {
  tombstones = new Map(list.map((t) => [t.id, t.deletedAt]));
  persist();
}

// Tests : tout oublier
export function resetTombstonesForTests(): void {
  tombstones = new Map();
  loaded = null;
}

// Nouvelle liste des tâches après une action de l'utilisateur (ou de l'app : bascule en Faire,
// archivage, récurrence…). Chaque tâche ajoutée ou dont le contenu change reçoit modifiedAt = now ;
// changer seulement les identifiants de notifications ne compte pas. Une tâche retirée laisse
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
    return taskContent(old) === taskContent(task) ? task : stamp(task);
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
