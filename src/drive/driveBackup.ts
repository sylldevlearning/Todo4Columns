import AsyncStorage from "@react-native-async-storage/async-storage";
import { BackupContent, BackupFile, buildBackup, parseBackup, ParsedBackup } from "../backup";
import { isRecord } from "../guards";
import { deleteFile, downloadText, DriveFile, listFiles, uploadJson } from "./driveApi";

// Sauvegarde Google Drive (facultative) : même fichier que l'export JSON, envoyé dans le dossier
// caché de l'app. Les 5 dernières sauvegardes sont gardées.
//
// L'état est enregistré à part (clé DRIVE_BACKUP), pas dans les réglages : les réglages font
// partie de la sauvegarde, et une restauration ne doit pas écraser l'état de la connexion.

export const DRIVE_STATE_KEY = "DRIVE_BACKUP";
export const DRIVE_FILE_PREFIX = "dofirst-backup-";
export const KEEP_BACKUPS = 5;
// Sauvegarde automatique : au plus une par jour
export const AUTO_BACKUP_INTERVAL = 24 * 60 * 60 * 1000;
// Après un échec (hors ligne…) : nouvel essai au plus tôt 15 min plus tard
export const RETRY_DELAY = 15 * 60 * 1000;

export interface DriveState {
  account: string | null; // e-mail du compte connecté, null = non connecté
  autoBackup: boolean;
  lastBackupAt: number | null; // dernière sauvegarde réussie depuis ce téléphone
  lastHash: string | null; // empreinte des données de cette sauvegarde
  lastAttemptAt: number | null; // dernier essai de sauvegarde automatique (réussi ou non)
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

// État partagé entre l'écran Réglages et la sauvegarde automatique
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

// Empreinte des données (sans la date de création) : la sauvegarde automatique ne part que si elles
// ont changé depuis la dernière sauvegarde. Hachage cyrb53, pas cryptographique.
export function backupHash(file: BackupFile): string {
  const { createdAt: _createdAt, ...data } = file;
  const text = JSON.stringify(data);
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

// Sauvegarde automatique à faire maintenant ? Connecté, activée, données changées, pas de
// sauvegarde réussie depuis 24 h, pas d'essai depuis 15 min.
export function autoBackupDue(state: DriveState, hash: string, now: number): boolean {
  if (state.account === null || !state.autoBackup) return false;
  if (hash === state.lastHash) return false;
  if (state.lastBackupAt !== null && now - state.lastBackupAt < AUTO_BACKUP_INTERVAL) return false;
  if (state.lastAttemptAt !== null && now - state.lastAttemptAt < RETRY_DELAY) return false;
  return true;
}

// « dofirst-backup-2026-11-08T14-30-00-000Z.json »
export const driveFileName = (now: number) =>
  `${DRIVE_FILE_PREFIX}${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`;

// Garde les KEEP_BACKUPS plus récentes, supprime les autres
export async function rotateBackups(files?: DriveFile[]): Promise<void> {
  const all = files ?? (await listFiles(DRIVE_FILE_PREFIX));
  for (const old of all.slice(KEEP_BACKUPS)) await deleteFile(old.id);
}

// Envoie une sauvegarde, puis fait tourner les anciennes. Lève une erreur en cas d'échec
// (hors ligne, accès retiré…) : l'état garde alors la dernière sauvegarde réussie.
export async function backupNow(content: Omit<BackupContent, "createdAt">, now: number): Promise<void> {
  const file = buildBackup(content, now);
  const uploaded = await uploadJson(driveFileName(now), JSON.stringify(file), {
    createdAt: String(now),
    tasks: String(content.tasks.length),
  });
  await updateDriveState({ lastBackupAt: now, lastHash: backupHash(file), lastAttemptAt: now });
  // La sauvegarde est faite : un échec de la rotation n'est pas un échec de la sauvegarde
  try {
    const files = await listFiles(DRIVE_FILE_PREFIX);
    if (!files.some((f) => f.id === uploaded.id)) files.unshift(uploaded);
    await rotateBackups(files);
  } catch (e) {
    console.warn("Rotation des sauvegardes Drive impossible :", errorLabel(e));
  }
}

export interface RemoteBackup {
  id: string;
  createdAt: number;
  tasks: number | null; // nombre de tâches, lu sans télécharger le fichier
}

// Sauvegarde la plus récente de ce Drive, ou null s'il n'y en a pas
export async function latestRemoteBackup(): Promise<RemoteBackup | null> {
  const [latest] = await listFiles(DRIVE_FILE_PREFIX);
  if (!latest) return null;
  const tasks = Number(latest.appProperties?.tasks);
  const createdAt = Number(latest.appProperties?.createdAt);
  return {
    id: latest.id,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.parse(latest.createdTime),
    tasks: Number.isFinite(tasks) ? tasks : null,
  };
}

// Télécharge et vérifie une sauvegarde (rien n'est écrit ici)
export async function readRemoteBackup(id: string): Promise<ParsedBackup> {
  return parseBackup(await downloadText(id));
}

// Supprime toutes les sauvegardes de l'app dans ce Drive
export async function deleteAllRemoteBackups(): Promise<void> {
  for (const f of await listFiles(DRIVE_FILE_PREFIX)) await deleteFile(f.id);
}

// Erreur résumée pour les journaux : jamais de jeton ni de contenu
export function errorLabel(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 120);
  return "erreur inconnue";
}
