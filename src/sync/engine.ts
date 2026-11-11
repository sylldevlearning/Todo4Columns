import AsyncStorage from "@react-native-async-storage/async-storage";
import { dayKey } from "../dates";
import { isRecord } from "../guards";
import { Settings } from "../settings";
import {
  completionKey,
  EMPTY_SYNC_DATA,
  hashData,
  mergeData,
  overrideWith,
  pruneSyncData,
  RemovedCompletion,
  SyncData,
} from "./merge";
import { RemoteStore } from "./remote";
import { buildSyncFile, ParsedSyncFile, parseSyncFile } from "./syncFile";

// Une synchronisation : télécharger l'actuel s'il a changé → fusionner avec les données du
// téléphone → les enregistrer → envoyer le résultat (écriture conditionnelle). Si un autre
// téléphone a écrit entre-temps : retélécharger, refusionner, réessayer.

export const MAX_ATTEMPTS = 4;
export const KEEP_COPIES = 5;

// Données du téléphone, vues par la synchronisation
export interface LocalSide {
  read(): Promise<{ data: SyncData; settings: Settings }>;
  // replace : les données remplacent celles du téléphone (sinon elles y sont fusionnées, pour ne
  // rien perdre de ce qui a changé pendant l'échange) ; settings : réglages à reprendre
  apply(data: SyncData, options: { replace: boolean; settings: Settings | null }): Promise<void>;
}

// État de la synchronisation sur ce téléphone
export interface SyncState {
  fileId: string | null;
  rev: string | null; // révision de l'actuel déjà fusionnée ici
  baseHash: string | null; // empreinte des données à cette révision
  lastSyncAt: number | null;
  migrated: boolean; // sauvegarde de la 1.5 déjà reprise (ou écartée)
  copyDay: string | null; // jour de la dernière copie quotidienne
}

export const DEFAULT_SYNC_STATE: SyncState = {
  fileId: null,
  rev: null,
  baseHash: null,
  lastSyncAt: null,
  migrated: false,
  copyDay: null,
};

export interface StateStore {
  load(): Promise<SyncState>;
  save(state: SyncState): Promise<void>;
}

export const SYNC_STATE_KEY = "DRIVE_SYNC";

export function parseSyncState(json: string | null): SyncState {
  try {
    const d: unknown = JSON.parse(json ?? "null");
    if (!isRecord(d)) return { ...DEFAULT_SYNC_STATE };
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      fileId: str(d.fileId),
      rev: str(d.rev),
      baseHash: str(d.baseHash),
      lastSyncAt: typeof d.lastSyncAt === "number" ? d.lastSyncAt : null,
      migrated: d.migrated === true,
      copyDay: str(d.copyDay),
    };
  } catch {
    return { ...DEFAULT_SYNC_STATE };
  }
}

export const storageStateStore: StateStore = {
  load: async () => parseSyncState(await AsyncStorage.getItem(SYNC_STATE_KEY)),
  save: (state) => AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state)),
};

// Fichier distant illisible ou écrit par une version plus récente de l'app : jamais écrasé
export class SyncFileError extends Error {
  constructor(readonly reason: "invalid" | "newer") {
    super(`Fichier synchronisé refusé : ${reason}`);
  }
}

// - merge : fusion (cas normal, et « Fusionner » à la connexion)
// - keepLocal : « Garder ce téléphone » (et retour à une copie) : ces données remplacent l'actuel
// - replaceLocal : « Remplacer par Google Drive » : l'actuel remplace les données du téléphone
export type SyncMode = "merge" | "keepLocal" | "replaceLocal";

export interface SyncDeps {
  remote: RemoteStore;
  local: LocalSide;
  store: StateStore;
  now?: () => number;
  // Sauvegarde de la 1.5 faite par ce téléphone (ses données sont déjà plus récentes)
  isOwnLegacy?: (writtenAt: number) => boolean;
}

export interface SyncOptions {
  mode?: SyncMode;
  adoptSettings?: boolean; // téléphone vide : reprend aussi les réglages du fichier
  // Retour à une copie : ces données remplacent celles du téléphone puis l'actuel (mode keepLocal)
  restore?: SyncData;
}

export interface SyncResult {
  applied: boolean; // données du téléphone modifiées
  uploaded: boolean; // actuel réécrit
  attempts: number;
}

function parseOrThrow(text: string, now: number): ParsedSyncFile {
  const parsed = parseSyncFile(text, now);
  if (!parsed.ok) throw new SyncFileError(parsed.reason);
  return parsed.file;
}

export async function syncOnce(deps: SyncDeps, options: SyncOptions = {}): Promise<SyncResult> {
  const { remote, local, store } = deps;
  const clock = deps.now ?? Date.now;
  let mode = options.mode ?? "merge";
  let state = await store.load();
  let applied = false;
  let uploaded = false;
  // Contenus d'autres téléphones écrasés par notre envoi : fusionnés au tour suivant
  let missed: SyncData[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const now = clock();
    const head = await remote.head();

    // 1. Télécharger l'actuel s'il a changé depuis la dernière synchronisation
    let remoteFile: ParsedSyncFile | null = null;
    let remoteHash: string | null = null;
    if (head === null) {
      // Pas encore d'actuel : la sauvegarde de la 1.5 sert de point de départ (une seule fois)
      if (!state.migrated || mode !== "merge") {
        const legacy = await remote.latestLegacy();
        const own = legacy !== null && mode === "merge" && deps.isOwnLegacy?.(legacy.writtenAt) === true;
        if (legacy && !own) remoteFile = legacy;
      }
    } else if (head.rev !== state.rev || head.duplicates.length > 0 || mode !== "merge") {
      remoteFile = parseOrThrow(await remote.download(head.id), now);
      remoteHash = hashData(remoteFile.data);
      for (const id of head.duplicates) {
        const other = parseOrThrow(await remote.download(id), now);
        remoteFile = { ...remoteFile, data: mergeData(remoteFile.data, other.data, now) };
      }
    }

    // 2. Fusionner avec les données du téléphone
    const read = await local.read();
    const settings = read.settings;
    // Retour à une copie : ses données, avec les suppressions et retraits notés ici
    const localData = options.restore
      ? { ...options.restore, deleted: read.data.deleted, removedCompletions: read.data.removedCompletions }
      : read.data;
    const remoteData = remoteFile?.data ?? null;
    let merged: SyncData;
    if (mode === "replaceLocal") merged = pruneSyncData(remoteData ?? EMPTY_SYNC_DATA, now);
    else if (mode === "keepLocal") merged = overrideWith(localData, remoteData ?? EMPTY_SYNC_DATA, now);
    // Sauvegarde de la 1.5 : à égalité de date, la version du téléphone gagne
    else merged = remoteData ? mergeData(localData, remoteData, now, { preferLocal: remoteFile?.legacy === true }) : pruneSyncData(localData, now);
    for (const other of missed) merged = mergeData(merged, other, now);
    missed = [];
    const mergedHash = hashData(merged);

    // 3. Enregistrer sur le téléphone
    if (mode !== "merge" || mergedHash !== hashData(localData)) {
      await local.apply(merged, {
        replace: mode === "replaceLocal" || options.restore !== undefined,
        settings: mode === "replaceLocal" && options.adoptSettings ? remoteFile?.settings ?? null : null,
      });
      applied = true;
    }

    // 4. Envoyer, sauf si l'actuel contient déjà exactement ces données
    const upToDate =
      head !== null &&
      head.duplicates.length === 0 &&
      (remoteHash !== null ? remoteHash === mergedHash : state.baseHash === mergedHash);
    let fileId = head?.id ?? null;
    let rev = head?.rev ?? null;
    // Écriture faite mais historique des révisions non vérifié : la prochaine synchronisation
    // retélécharge l'actuel en entier
    let unverified = false;
    let content: string | null = null;
    if (!upToDate) {
      content = buildSyncFile(merged, settings, now);
      if (head === null) {
        const created = await remote.create(content, merged.tasks.length);
        fileId = created.id;
        rev = created.rev;
      } else {
        const result = await remote.update(head.id, content, head.rev, merged.tasks.length);
        if (result.status === "changed") continue; // un autre téléphone vient d'écrire
        rev = result.rev;
        unverified = result.unverified === true;
        missed = result.missed.map((text) => parseOrThrow(text, now).data);
        for (const id of head.duplicates) await remote.remove(id).catch(() => {});
      }
      uploaded = true;
    }

    state = {
      ...state,
      fileId,
      rev: unverified ? null : rev,
      baseHash: mergedHash,
      lastSyncAt: now,
      migrated: true,
    };
    await store.save(state);
    // Écriture croisée : notre envoi a écrasé celui d'un autre téléphone ; ses données sont
    // fusionnées et renvoyées au tour suivant
    if (missed.length > 0) {
      mode = "merge";
      continue;
    }

    // 5. Copie du jour (la première synchronisation de chaque jour), 5 jours gardés
    const day = dayKey(now);
    if (state.copyDay !== day) {
      try {
        await remote.writeCopy(day, content ?? buildSyncFile(merged, settings, now), merged.tasks.length);
        const copies = await remote.listCopies();
        const days = [...new Set(copies.map((c) => c.day))].sort().reverse().slice(0, KEEP_COPIES);
        const kept = new Set<string>();
        for (const copy of copies) {
          // Une seule copie par jour (la plus récente), et seulement les 5 derniers jours
          if (days.includes(copy.day) && !kept.has(copy.day)) kept.add(copy.day);
          else await remote.remove(copy.id);
        }
        state = { ...state, copyDay: day };
        await store.save(state);
      } catch (e) {
        console.warn("Copie du jour sur Drive impossible :", e instanceof Error ? e.message : "erreur");
      }
    }
    return { applied, uploaded, attempts: attempt };
  }
  throw new Error("Synchronisation : trop d'écritures croisées, nouvel essai plus tard");
}

// Lecture seule de ce qu'il y a en ligne (à la connexion) : l'actuel, sinon la sauvegarde de la 1.5
export async function peekRemote(remote: RemoteStore): Promise<ParsedSyncFile | null> {
  const head = await remote.head();
  if (head) return parseOrThrow(await remote.download(head.id), Date.now());
  return remote.latestLegacy();
}
