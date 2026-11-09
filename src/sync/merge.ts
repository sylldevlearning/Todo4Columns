import { Completion } from "../completionLog";
import { Task } from "../types";

// Fusion des données de deux téléphones (synchronisation Google Drive, 1.6).
//
// Fonctions pures : rien n'est lu ni écrit ici. La fusion est commutative et idempotente
// (fusionner A et B donne la même chose que B et A, et refusionner ne change plus rien) :
// tous les téléphones finissent avec les mêmes données, quel que soit l'ordre des échanges.

// Suppression gardée 90 jours pour être transmise aux autres téléphones
export interface Tombstone {
  id: string;
  deletedAt: number;
}

// Entrée du journal retirée (tâche rouverte) : clé « date|quadrant »
export interface RemovedCompletion {
  key: string;
  removedAt: number;
}

export interface SyncData {
  tasks: Task[];
  deleted: Tombstone[];
  completions: Completion[];
  removedCompletions: RemovedCompletion[];
  reviewWeeks: string[];
}

// Durée de vie d'une pierre tombale : un téléphone resté hors ligne plus longtemps peut faire
// revenir une tâche supprimée
export const TOMBSTONE_TTL = 90 * 24 * 60 * 60 * 1000;

export const EMPTY_SYNC_DATA: SyncData = {
  tasks: [],
  deleted: [],
  completions: [],
  removedCompletions: [],
  reviewWeeks: [],
};

// Date de la dernière modification d'une tâche, pour la synchronisation. Les tâches enregistrées
// avant la 1.6 n'ont pas de modifiedAt : on prend la plus récente des dates connues (le même calcul
// sur tous les téléphones, donc la même valeur pour une même tâche).
export function modifiedAtOf(task: Task): number {
  if (typeof task.modifiedAt === "number") return task.modifiedAt;
  let latest = Math.max(task.createdAt, task.updatedAt);
  for (const v of [task.completedAt, task.archivedAt]) if (typeof v === "number" && v > latest) latest = v;
  for (const s of task.steps ?? []) if (typeof s.doneAt === "number" && s.doneAt > latest) latest = s.doneAt;
  return latest;
}

// Contenu d'une tâche, sans ce qui est propre à ce téléphone (identifiants des notifications) ni
// sa date de modification : deux contenus égaux sont la même version
export const taskContent = (task: Task) =>
  JSON.stringify({ ...task, notificationIds: undefined, modifiedAt: undefined });

export const completionKey = (c: Completion) => `${c.date}|${c.category}`;

// Version gagnante d'une tâche : la plus récente ; à égalité, choix fixe (contenu le plus grand)
// pour que chaque téléphone choisisse la même
function newer(a: Task, b: Task): Task {
  const ma = modifiedAtOf(a);
  const mb = modifiedAtOf(b);
  if (ma !== mb) return ma > mb ? a : b;
  return taskContent(a) >= taskContent(b) ? a : b;
}

// Union par clé, en gardant la date la plus récente ; les entrées expirées sont oubliées
function mergeDated<T>(lists: T[][], keyOf: (v: T) => string, dateOf: (v: T) => number, oldest: number): T[] {
  const byKey = new Map<string, T>();
  for (const list of lists) {
    for (const v of list) {
      if (dateOf(v) < oldest) continue;
      const key = keyOf(v);
      const known = byKey.get(key);
      if (!known || dateOf(v) > dateOf(known)) byKey.set(key, v);
    }
  }
  return [...byKey.values()].sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0));
}

// Journal : union (une entrée présente des deux côtés n'est comptée qu'une fois ; deux tâches
// terminées dans la même milliseconde gardent leurs deux entrées), sans les entrées retirées
function mergeCompletions(a: Completion[], b: Completion[], removed: Set<string>): Completion[] {
  const count = (list: Completion[]) => {
    const m = new Map<string, Completion[]>();
    for (const c of list) {
      const key = completionKey(c);
      m.set(key, [...(m.get(key) ?? []), c]);
    }
    return m;
  };
  const ca = count(a);
  const cb = count(b);
  const result: Completion[] = [];
  for (const key of new Set([...ca.keys(), ...cb.keys()])) {
    if (removed.has(key)) continue;
    const xa = ca.get(key) ?? [];
    const xb = cb.get(key) ?? [];
    result.push(...(xa.length >= xb.length ? xa : xb));
  }
  return result.sort((x, y) => x.date - y.date || (x.category < y.category ? -1 : x.category > y.category ? 1 : 0));
}

// Fusion par identifiant : la version la plus récente gagne ; une pierre tombale gagne si la
// suppression est plus récente que la dernière modification, sinon la tâche revient (modifiée
// après sa suppression sur un autre téléphone) et la pierre tombale est oubliée.
// L'ordre de local est gardé ; les tâches venues de remote sont ajoutées à la suite. Une tâche
// gardée telle quelle reste le même objet (pas de nouveau rendu, notifications inchangées), et
// garde les identifiants de notifications de ce téléphone.
export function mergeData(local: SyncData, remote: SyncData, now: number): SyncData {
  const oldest = now - TOMBSTONE_TTL;
  const deletedAll = mergeDated([local.deleted, remote.deleted], (t) => t.id, (t) => t.deletedAt, oldest);
  const deletedAt = new Map(deletedAll.map((t) => [t.id, t.deletedAt]));

  const remoteById = new Map(remote.tasks.map((t) => [t.id, t]));
  const localIds = new Set(local.tasks.map((t) => t.id));
  const resurrected = new Set<string>();
  const tasks: Task[] = [];
  const keep = (task: Task) => {
    const gone = deletedAt.get(task.id);
    if (gone !== undefined && gone >= modifiedAtOf(task)) return;
    if (gone !== undefined) resurrected.add(task.id);
    tasks.push(task);
  };
  for (const mine of local.tasks) {
    const theirs = remoteById.get(mine.id);
    if (!theirs) {
      keep(mine);
      continue;
    }
    const winner = newer(mine, theirs);
    if (winner === mine) keep(mine);
    // Même contenu, date plus récente ailleurs : on garde l'objet local, avec cette date (sinon
    // les deux téléphones se renverraient chacun la leur)
    else if (taskContent(winner) === taskContent(mine)) keep({ ...mine, modifiedAt: modifiedAtOf(winner) });
    else keep({ ...winner, notificationIds: mine.notificationIds });
  }
  for (const theirs of remote.tasks) {
    if (!localIds.has(theirs.id)) keep({ ...theirs, notificationIds: [] });
  }

  const removedCompletions = mergeDated(
    [local.removedCompletions, remote.removedCompletions],
    (r) => r.key,
    (r) => r.removedAt,
    oldest
  );
  const removedKeys = new Set(removedCompletions.map((r) => r.key));

  return {
    tasks,
    deleted: deletedAll.filter((t) => !resurrected.has(t.id)),
    completions: mergeCompletions(local.completions, remote.completions, removedKeys),
    removedCompletions,
    reviewWeeks: [...new Set([...local.reviewWeeks, ...remote.reviewWeeks])].sort().reverse().slice(0, 60),
  };
}

// Pierres tombales et retraits expirés oubliés (sans autre fusion)
export const pruneSyncData = (data: SyncData, now: number): SyncData => mergeData(data, EMPTY_SYNC_DATA, now);

// Forme canonique (ordre fixe, sans ce qui est propre au téléphone) : deux téléphones aux mêmes
// données ont la même empreinte
export function canonicalJson(data: SyncData): string {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return JSON.stringify({
    tasks: [...data.tasks].sort(byId).map((t) => [t.id, modifiedAtOf(t), taskContent(t)]),
    deleted: [...data.deleted].sort(byId).map((t) => [t.id, t.deletedAt]),
    completions: data.completions.map(completionKey).sort(),
    removed: [...data.removedCompletions].map((r) => `${r.key}@${r.removedAt}`).sort(),
    reviewWeeks: [...new Set(data.reviewWeeks)].sort(),
  });
}

// Empreinte cyrb53 (pas cryptographique) d'un texte
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const hashData = (data: SyncData) => hashText(canonicalJson(data));

// « Garder ce téléphone » ou retour à une copie : les données de local remplacent celles de
// remote partout. Chaque tâche de local devient la plus récente, et tout ce qui n'existe que dans
// remote est supprimé (pierres tombales), pour que les autres téléphones suivent.
export function overrideWith(local: SyncData, remote: SyncData, now: number): SyncData {
  const localIds = new Set(local.tasks.map((t) => t.id));
  const localKeys = new Set(local.completions.map(completionKey));
  return pruneSyncData(
    {
      tasks: local.tasks.map((t) => ({ ...t, modifiedAt: now })),
      deleted: [
        ...local.deleted.filter((t) => !localIds.has(t.id)),
        ...remote.deleted.filter((t) => !localIds.has(t.id)),
        ...remote.tasks.filter((t) => !localIds.has(t.id)).map((t) => ({ id: t.id, deletedAt: now })),
      ],
      completions: local.completions,
      removedCompletions: [
        ...local.removedCompletions.filter((r) => !localKeys.has(r.key)),
        ...remote.completions
          .map(completionKey)
          .filter((key) => !localKeys.has(key))
          .map((key) => ({ key, removedAt: now })),
      ],
      reviewWeeks: local.reviewWeeks,
    },
    now
  );
}
