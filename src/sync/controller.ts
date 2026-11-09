import { DriveError } from "../drive/driveApi";
import { loadDriveState, updateDriveState } from "../drive/driveBackup";
import { NotSignedInError } from "../drive/googleAccount";
import { loadReviewWeeks, saveReviewWeeks } from "../review";
import type { TaskActions } from "../store/TasksContext";
import { getTombstones } from "./localChanges";
import {
  DEFAULT_SYNC_STATE,
  LocalSide,
  StateStore,
  syncOnce,
  SyncFileError,
  SyncMode,
  SyncResult,
} from "./engine";
import { hashData, SyncData } from "./merge";
import { RemoteStore } from "./remote";

// Pilote de la synchronisation : une seule à la fois, déclenchée 10 s après le dernier
// changement, au passage en arrière-plan, à l'ouverture de l'app et après la connexion.
// Hors ligne : rien n'est affiché (sauf l'icône nuage), nouvel essai plus tard.

export const SYNC_DEBOUNCE_MS = 10 * 1000;
// Nouveaux essais après un échec : 30 s, 2 min, 10 min, puis toutes les 30 min
export const RETRY_DELAYS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000, 30 * 60 * 1000];
// Retour dans l'app : au plus une synchronisation toutes les 30 s
export const MIN_OPEN_INTERVAL = 30 * 1000;

export type SyncPhase = "off" | "idle" | "syncing" | "offline" | "error";
export type SyncFailure = "offline" | "newer" | "signedOut" | "other";

export interface SyncStatus {
  phase: SyncPhase;
  lastSyncAt: number | null;
  error: SyncFailure | null;
}

let status: SyncStatus = { phase: "off", lastSyncAt: null, error: null };
const listeners = new Set<() => void>();
export const getSyncStatus = () => status;
export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function setStatus(change: Partial<SyncStatus>) {
  status = { ...status, ...change };
  listeners.forEach((l) => l());
}

export interface SyncSetup {
  remote: RemoteStore;
  store: StateStore;
  local: LocalSide;
  canSync: () => boolean; // tâches lues sans erreur
}

let setup: SyncSetup | null = null;
let running: Promise<SyncOutcome> | null = null;
let rerun = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryIndex = 0;
let lastStartedAt = 0;

export type SyncOutcome = { ok: true; result: SyncResult | null } | { ok: false; error: SyncFailure };

export async function configureSync(next: SyncSetup | null): Promise<void> {
  setup = next;
  if (!next) return;
  const [drive, state] = await Promise.all([loadDriveState(), next.store.load()]);
  setStatus({ phase: drive.account === null ? "off" : "idle", lastSyncAt: state.lastSyncAt, error: null });
}

function classify(e: unknown): SyncFailure {
  if (e instanceof NotSignedInError) return "signedOut";
  if (e instanceof SyncFileError) return e.reason === "newer" ? "newer" : "other";
  if (e instanceof TypeError) return "offline"; // pas de réseau
  if (e instanceof DriveError && (e.status === 429 || e.status >= 500)) return "offline"; // Drive indisponible
  return "other";
}

const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
  if (timer !== null) clearTimeout(timer);
  return null;
};

export interface SyncRequest {
  mode?: SyncMode;
  adoptSettings?: boolean;
  manual?: boolean; // demandée par l'utilisateur : faite même si la synchronisation automatique est coupée
  onlyIfChanged?: boolean; // seulement si les données de ce téléphone ont changé (pas de téléchargement sinon)
  restore?: SyncData; // retour à une copie
}

// Choix en attente à la connexion (« Fusionner », « Remplacer », « Garder ») : pas de
// synchronisation automatique avant
let paused = false;
export function pauseSync(value: boolean): void {
  paused = value;
}

async function run(request: SyncRequest): Promise<SyncOutcome> {
  const current = setup;
  if (!current || !current.canSync()) return { ok: true, result: null };
  const drive = await loadDriveState();
  if (drive.account === null) {
    setStatus({ phase: "off", error: null });
    return { ok: true, result: null };
  }
  if (!request.manual && (!drive.autoBackup || paused)) return { ok: true, result: null };
  if (request.onlyIfChanged) {
    const state = await current.store.load();
    const { data } = await current.local.read();
    // Même empreinte qu'à la dernière synchronisation (journal compris) : rien à envoyer
    if (state.rev !== null && state.baseHash === hashData({ ...data, removedCompletions: state.removedLog })) {
      return { ok: true, result: null };
    }
  }
  debounceTimer = clearTimer(debounceTimer);
  retryTimer = clearTimer(retryTimer);
  lastStartedAt = Date.now();
  setStatus({ phase: "syncing" });
  try {
    const result = await syncOnce(
      { remote: current.remote, local: current.local, store: current.store, isOwnLegacy: (w) => drive.lastBackupAt === w },
      { mode: request.mode, adoptSettings: request.adoptSettings, restore: request.restore }
    );
    retryIndex = 0;
    setStatus({ phase: "idle", lastSyncAt: (await current.store.load()).lastSyncAt, error: null });
    return { ok: true, result };
  } catch (e) {
    const error = classify(e);
    if (error === "signedOut") {
      // Accès retiré ou expiré : plus d'essai avant une nouvelle connexion
      await updateDriveState({ account: null }).catch(() => {});
      await current.store.save({ ...DEFAULT_SYNC_STATE }).catch(() => {});
      setStatus({ phase: "off", error });
      return { ok: false, error };
    }
    if (error !== "offline") console.warn("Synchronisation Drive impossible :", e instanceof Error ? e.message : "erreur");
    setStatus({ phase: error === "offline" ? "offline" : "error", error });
    // Nouvel essai plus tard, sans message (sauf un fichier d'une version plus récente de l'app)
    if (error !== "newer") {
      const delay = RETRY_DELAYS[Math.min(retryIndex++, RETRY_DELAYS.length - 1)];
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void syncNow();
      }, delay);
    }
    return { ok: false, error };
  }
}

// Synchronise maintenant. Si une synchronisation est en cours : une demande automatique est
// regroupée (une seule autre suivra), une demande de l'utilisateur attend son tour.
export function syncNow(request: SyncRequest = {}): Promise<SyncOutcome> {
  const special = request.manual || (request.mode ?? "merge") !== "merge";
  if (running) {
    if (!special) {
      rerun = true;
      return running;
    }
    return running.then(() => syncNow(request));
  }
  const promise = run(request).finally(() => {
    running = null;
    if (rerun) {
      rerun = false;
      void syncNow({ onlyIfChanged: true });
    }
  });
  running = promise;
  return promise;
}

// Changement local : synchronisation 10 s après le dernier
export function scheduleSync(delay: number = SYNC_DEBOUNCE_MS): void {
  if (!setup) return;
  debounceTimer = clearTimer(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow({ onlyIfChanged: true });
  }, delay);
}

// Passage en arrière-plan : les changements en attente partent tout de suite
export function flushSync(): Promise<SyncOutcome> {
  debounceTimer = clearTimer(debounceTimer);
  return syncNow({ onlyIfChanged: true });
}

// Retour dans l'app : synchronisation complète, au plus une toutes les 30 s
export function syncOnOpen(now: number = Date.now()): Promise<SyncOutcome> | null {
  if (now - lastStartedAt < MIN_OPEN_INTERVAL) return null;
  return syncNow();
}

// Déconnexion ou suppression des données en ligne
export function stopSync(): void {
  debounceTimer = clearTimer(debounceTimer);
  retryTimer = clearTimer(retryTimer);
  retryIndex = 0;
  setStatus({ phase: "off", lastSyncAt: null, error: null });
}

// Connexion, ou données en ligne supprimées : pas encore de synchronisation
export function markSignedIn(): void {
  setStatus({ phase: "idle", lastSyncAt: null, error: null });
}

// Tests : tout oublier
export function resetSyncControllerForTests(): void {
  stopSync();
  setup = null;
  running = null;
  rerun = false;
  paused = false;
  lastStartedAt = 0;
}

// Données du téléphone vues par la synchronisation : tâches, suppressions, journal (état de
// l'app) et revues (enregistrées à part)
export function createLocalSide(actions: TaskActions): LocalSide {
  return {
    async read() {
      const { tasks, completions } = actions.getTasksState();
      return {
        data: { tasks, deleted: getTombstones(), completions, removedCompletions: [], reviewWeeks: await loadReviewWeeks() },
        settings: actions.getSettings(),
      };
    },
    async apply(data, { replace, settings }) {
      actions.applySynced(data, { replace });
      await saveReviewWeeks(data.reviewWeeks);
      if (settings) actions.updateSettings(settings);
    },
  };
}
