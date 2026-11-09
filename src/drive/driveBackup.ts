import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRecord } from "../guards";

// Connexion Google Drive (facultative) : compte et synchronisation automatique.
//
// L'état est enregistré à part (clé DRIVE_BACKUP, nom gardé depuis la 1.5), pas dans les
// réglages : une restauration ne doit pas écraser l'état de la connexion. La synchronisation
// elle-même est dans src/sync.

export const DRIVE_STATE_KEY = "DRIVE_BACKUP";
// Sauvegardes de la 1.5 (« dofirst-backup-….json ») : reprises une fois par la synchronisation
export const DRIVE_FILE_PREFIX = "dofirst-backup-";

export interface DriveState {
  account: string | null; // e-mail du compte connecté, null = non connecté
  autoBackup: boolean; // synchronisation automatique (nom gardé depuis la 1.5)
  // 1.5 : dernière sauvegarde envoyée depuis ce téléphone. Sert à reconnaître, à la mise à jour,
  // une sauvegarde faite par ce téléphone (ses données sont alors déjà plus récentes).
  lastBackupAt: number | null;
  lastHash: string | null; // 1.5, plus utilisé
  lastAttemptAt: number | null; // 1.5, plus utilisé
}

export const DEFAULT_DRIVE_STATE: DriveState = {
  account: null,
  autoBackup: true,
  lastBackupAt: null,
  lastHash: null,
  lastAttemptAt: null,
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseDriveState(json: string | null): DriveState {
  if (json === null) return { ...DEFAULT_DRIVE_STATE };
  try {
    const data: unknown = JSON.parse(json);
    if (!isRecord(data)) return { ...DEFAULT_DRIVE_STATE };
    return {
      account: typeof data.account === "string" && data.account !== "" ? data.account : null,
      autoBackup: typeof data.autoBackup === "boolean" ? data.autoBackup : DEFAULT_DRIVE_STATE.autoBackup,
      lastBackupAt: num(data.lastBackupAt),
      lastHash: typeof data.lastHash === "string" ? data.lastHash : null,
      lastAttemptAt: num(data.lastAttemptAt),
    };
  } catch {
    return { ...DEFAULT_DRIVE_STATE };
  }
}

// État partagé entre les écrans et la synchronisation
let current: DriveState = { ...DEFAULT_DRIVE_STATE };
let loaded: Promise<DriveState> | null = null;
const listeners = new Set<() => void>();

export const getDriveState = () => current;

export function subscribeDriveState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// État enregistré, lu une seule fois ; ensuite l'état courant (mises à jour comprises)
export async function loadDriveState(): Promise<DriveState> {
  loaded ??= AsyncStorage.getItem(DRIVE_STATE_KEY)
    .then(parseDriveState)
    .catch(() => ({ ...DEFAULT_DRIVE_STATE }))
    .then((state) => {
      current = state;
      listeners.forEach((l) => l());
      return state;
    });
  await loaded;
  return current;
}

export async function updateDriveState(change: Partial<DriveState>): Promise<DriveState> {
  await loadDriveState();
  current = { ...current, ...change };
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(DRIVE_STATE_KEY, JSON.stringify(current));
  return current;
}

// Tests : état oublié entre deux tests
export function resetDriveStateForTests() {
  current = { ...DEFAULT_DRIVE_STATE };
  loaded = null;
  listeners.clear();
}

// Erreur résumée pour les journaux : jamais de jeton ni de contenu
export function errorLabel(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 120);
  return "erreur inconnue";
}
