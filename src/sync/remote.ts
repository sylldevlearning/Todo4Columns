import { parseBackup } from "../backup";
import { DRIVE_FILE_PREFIX } from "../drive/driveBackup";
import {
  deleteFile,
  downloadRevision,
  downloadText,
  DriveFile,
  getFile,
  listFiles,
  listRevisions,
  updateContent,
  uploadJson,
} from "../drive/driveApi";
import { COPY_PREFIX, fromLegacyBackup, ParsedSyncFile, SYNC_FILE_NAME } from "./syncFile";

// Stockage distant de la synchronisation. L'interface permet de simuler Google Drive dans les
// tests (plusieurs téléphones, écritures croisées).

export interface RemoteHead {
  id: string;
  rev: string; // révision du contenu
  duplicates: string[]; // autres fichiers « actuels » (créés en même temps par deux téléphones)
}

// Envoi conditionnel :
// - changed : l'actuel a changé depuis expectedRev, rien n'a été écrit (retélécharger, refusionner)
// - written : écrit ; missed = contenus d'autres téléphones écrits entre la vérification et
//   l'envoi, écrasés par celui-ci (à refusionner et renvoyer)
// - unverified : historique illisible ou sans notre révision ; la prochaine synchronisation
//   retélécharge l'actuel en entier
export type UpdateResult =
  | { status: "changed" }
  | { status: "written"; rev: string; missed: string[]; unverified?: boolean };

export interface RemoteCopy {
  id: string;
  day: string; // « 2026-11-09 »
  createdAt: number;
  tasks: number | null;
}

export interface RemoteStore {
  head(): Promise<RemoteHead | null>;
  download(id: string): Promise<string>;
  create(content: string, tasks: number): Promise<{ id: string; rev: string }>;
  update(id: string, content: string, expectedRev: string, tasks: number): Promise<UpdateResult>;
  remove(id: string): Promise<void>;
  // Dernière sauvegarde de la 1.5 (avant la synchronisation), ou null
  latestLegacy(): Promise<ParsedSyncFile | null>;
  listCopies(): Promise<RemoteCopy[]>; // de la plus récente à la plus ancienne
  writeCopy(day: string, content: string, tasks: number): Promise<void>;
  removeAll(): Promise<void>; // actuel, copies et sauvegardes de la 1.5
}

const props = (tasks: number) => ({ tasks: String(tasks), writtenAt: String(Date.now()) });
const revOf = (f: DriveFile) => f.headRevisionId ?? "";

// Google Drive (dossier caché appDataFolder). Drive v3 ne propose pas d'écriture conditionnelle
// (l'en-tête If-Match y est ignoré) : la révision est revérifiée juste avant l'envoi, et
// l'historique des révisions juste après, pour retrouver une écriture croisée.
export const driveRemote: RemoteStore = {
  // Une seule requête : la liste (et non le fichier connu), pour voir un éventuel doublon
  async head() {
    const files = (await listFiles(SYNC_FILE_NAME)).filter((f) => f.name === SYNC_FILE_NAME);
    if (files.length === 0) return null;
    // Le plus ancien reste l'actuel ; les autres seront fusionnés puis supprimés
    const [first, ...others] = [...files].sort((a, b) => Date.parse(a.createdTime) - Date.parse(b.createdTime));
    return { id: first.id, rev: revOf(first), duplicates: others.map((f) => f.id) };
  },

  download: downloadText,

  async create(content, tasks) {
    const file = await uploadJson(SYNC_FILE_NAME, content, props(tasks));
    return { id: file.id, rev: revOf(file) };
  },

  async update(id, content, expectedRev, tasks) {
    const current = await getFile(id);
    if (!current || revOf(current) !== expectedRev) return { status: "changed" };
    const written = await updateContent(id, content, props(tasks));
    const rev = revOf(written);
    let missed: string[] = [];
    let unverified = false;
    try {
      const revisions = await listRevisions(id);
      const mine = revisions.findIndex((r) => r.id === rev);
      const expected = revisions.findIndex((r) => r.id === expectedRev);
      if (mine === -1) {
        unverified = true;
        console.warn("Vérification des révisions Drive impossible :", "révision envoyée introuvable dans l'historique");
      }
      // Révisions entre celle qu'on attendait et la nôtre : écrites par un autre téléphone
      if (mine > 0 && revisions[mine - 1].id !== expectedRev) {
        const from = expected >= 0 && expected < mine ? expected + 1 : mine - 1;
        missed = await Promise.all(revisions.slice(from, mine).map((r) => downloadRevision(id, r.id)));
      }
    } catch (e) {
      // Historique illisible : l'autre téléphone renverra ses changements à sa prochaine synchronisation
      unverified = true;
      console.warn("Vérification des révisions Drive impossible :", e instanceof Error ? e.message : "erreur");
    }
    return { status: "written", rev, missed, unverified };
  },

  remove: deleteFile,

  async latestLegacy() {
    const [latest] = await listFiles(DRIVE_FILE_PREFIX);
    if (!latest) return null;
    const parsed = parseBackup(await downloadText(latest.id));
    if (!parsed.ok) return null;
    // Date d'envoi notée par la 1.5 : sert à reconnaître une sauvegarde faite par ce téléphone
    const createdAt = Number(latest.appProperties?.createdAt);
    return fromLegacyBackup(parsed, Number.isFinite(createdAt) ? createdAt : parsed.backup.createdAt);
  },

  async listCopies() {
    return (await listFiles(COPY_PREFIX)).flatMap((f) => {
      const day = f.name.slice(COPY_PREFIX.length, COPY_PREFIX.length + 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
      const tasks = Number(f.appProperties?.tasks);
      return [{ id: f.id, day, createdAt: Date.parse(f.createdTime), tasks: Number.isFinite(tasks) ? tasks : null }];
    });
  },

  async writeCopy(day, content, tasks) {
    await uploadJson(`${COPY_PREFIX}${day}.json`, content, props(tasks));
  },

  async removeAll() {
    for (const prefix of [SYNC_FILE_NAME, COPY_PREFIX, DRIVE_FILE_PREFIX]) {
      for (const f of await listFiles(prefix)) await deleteFile(f.id);
    }
  },
};
