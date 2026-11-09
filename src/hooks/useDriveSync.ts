import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { showAlert } from "../appWindows";
import { savePreImportCopy } from "../backup";
import {
  DEFAULT_DRIVE_STATE,
  errorLabel,
  getDriveState,
  loadDriveState,
  subscribeDriveState,
  updateDriveState,
} from "../drive/driveBackup";
import { signIn, signOut } from "../drive/googleAccount";
import { formatDue, formatShortDate } from "../format";
import { t } from "../i18n";
import { useTaskActions } from "../store/TasksContext";
import {
  getSyncStatus,
  markSignedIn,
  pauseSync,
  stopSync,
  subscribeSyncStatus,
  SyncFailure,
  syncNow,
  SyncRequest,
  SyncStatus,
} from "../sync/controller";
import { DEFAULT_SYNC_STATE, peekRemote, storageStateStore, SyncFileError } from "../sync/engine";
import { driveRemote, RemoteCopy } from "../sync/remote";
import { ParsedSyncFile, parseSyncFile } from "../sync/syncFile";

// État de la connexion Google Drive (compte, synchronisation automatique)
export function useDriveState() {
  useEffect(() => {
    void loadDriveState();
  }, []);
  return useSyncExternalStore(subscribeDriveState, getDriveState);
}

// État de la synchronisation (icône nuage, Réglages)
export const useSyncStatus = () => useSyncExternalStore(subscribeSyncStatus, getSyncStatus);

// Ligne d'état : « Synchronisé : Lun. 9 nov. · 14:32 », « Hors ligne… »
export function syncStatusLine(status: SyncStatus): string {
  switch (status.phase) {
    case "syncing":
      return t.drive.syncing;
    case "offline":
      return t.drive.offline;
    case "error":
      return status.error === "newer" ? t.drive.newer : t.drive.error;
    default:
      return status.lastSyncAt === null ? t.drive.never : t.drive.synced(formatDue(status.lastSyncAt));
  }
}

// Message après un échec d'une action demandée par l'utilisateur (les échecs automatiques sont
// silencieux : seule l'icône nuage change)
function showFailure(error: SyncFailure) {
  if (error === "signedOut") showAlert(t.drive.signedOutTitle, t.drive.signedOutBody);
  else if (error === "newer") showAlert(t.drive.newerTitle, t.drive.newerBody);
  else showAlert(t.drive.syncErrorTitle, t.drive.syncErrorBody);
}

// Synchronisation Google Drive : connexion, « Synchroniser maintenant », copies, déconnexion…
// (Réglages, présentation, carte de la matrice, icône nuage)
export function useDriveSync() {
  const actions = useTaskActions();
  const state = useDriveState();
  const status = useSyncStatus();
  // Une seule opération à la fois (boutons désactivés pendant ce temps)
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  // Copies du jour, affichées sur demande dans les Réglages
  const [copies, setCopies] = useState<RemoteCopy[] | null>(null);

  const run = async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  // Synchronisation demandée : vrai si elle a réussi (sinon un message)
  const syncWith = async (request: SyncRequest): Promise<boolean> => {
    const outcome = await syncNow({ ...request, manual: true });
    if (!outcome.ok) showFailure(outcome.error);
    return outcome.ok;
  };

  // Données des deux côtés : l'utilisateur choisit (rien n'est synchronisé avant)
  const askChoice = (remoteTasks: number, localTasks: number) => {
    pauseSync(true);
    const choose = (request: SyncRequest, before?: () => Promise<void>) => () => {
      pauseSync(false);
      void run(async () => {
        await before?.();
        await syncWith(request);
      });
    };
    showAlert(
      t.drive.choiceTitle,
      t.drive.choiceBody(remoteTasks, localTasks),
      [
        { text: t.drive.keep, onPress: choose({ mode: "keepLocal" }) },
        {
          text: t.drive.replace,
          style: "destructive",
          // Copie de secours : « Annuler le dernier import » ramène les données d'avant
          onPress: choose({ mode: "replaceLocal" }, () => savePreImportCopy(Date.now()).catch(() => {})),
        },
        { text: t.drive.merge, onPress: choose({ mode: "merge" }) },
      ],
      { cancelable: false }
    );
  };

  // Connexion ; vrai si un compte est connecté. Données en ligne et sur ce téléphone : choix ;
  // téléphone vide : tout est récupéré d'office (réglages compris) ; rien en ligne : envoi.
  const connect = async (): Promise<boolean> => {
    let connected = false;
    await run(async () => {
      let account: string | null;
      try {
        account = await signIn();
      } catch (e) {
        console.warn("Connexion Google impossible :", errorLabel(e));
        showAlert(t.drive.connectErrorTitle, t.drive.connectErrorBody);
        return;
      }
      if (account === null) return; // annulé
      connected = true;
      pauseSync(true);
      await updateDriveState({ ...DEFAULT_DRIVE_STATE, account, autoBackup: true });
      await storageStateStore.save({ ...DEFAULT_SYNC_STATE });
      markSignedIn();
      let remote: ParsedSyncFile | null;
      try {
        remote = await peekRemote(driveRemote);
      } catch (e) {
        pauseSync(false);
        if (e instanceof SyncFileError && e.reason === "newer") showFailure("newer");
        else console.warn("Lecture de Google Drive impossible :", errorLabel(e));
        // Hors ligne : synchronisation (fusion) au prochain essai automatique
        void syncNow();
        return;
      }
      pauseSync(false);
      const localTasks = actions.getTasksState().tasks.length;
      const remoteTasks = remote?.data.tasks.length ?? 0;
      if (remote === null || remoteTasks === 0) {
        await syncWith({});
      } else if (localTasks === 0) {
        if (await syncWith({ mode: "replaceLocal", adoptSettings: true })) {
          showAlert(t.driveRestore.title, t.driveRestore.body(formatShortDate(remote.writtenAt)));
        }
      } else {
        askChoice(remoteTasks, localTasks);
      }
    });
    return connected;
  };

  const syncManually = () => run(async () => void (await syncWith({})));

  const showCopies = () =>
    run(async () => {
      try {
        setCopies(await driveRemote.listCopies());
      } catch (e) {
        console.warn("Liste des copies Drive impossible :", errorLabel(e));
        showFailure("offline");
      }
    });

  // Retour à une copie : elle remplace les données de ce téléphone puis celles de l'actuel,
  // donc de tous les téléphones (copie de secours de ce téléphone gardée)
  const restoreCopy = (copy: RemoteCopy) =>
    showAlert(t.drive.copyConfirmTitle, t.drive.copyConfirmBody(formatShortDate(copy.createdAt)), [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.drive.copyAction,
        style: "destructive",
        onPress: () =>
          void run(async () => {
            let text: string;
            try {
              text = await driveRemote.download(copy.id);
            } catch (e) {
              console.warn("Lecture de la copie Drive impossible :", errorLabel(e));
              showAlert(t.drive.restoreErrorTitle, t.drive.restoreErrorBody);
              return;
            }
            const parsed = parseSyncFile(text);
            if (!parsed.ok) {
              showFailure(parsed.reason === "newer" ? "newer" : "other");
              return;
            }
            await savePreImportCopy(Date.now()).catch(() => {});
            if (await syncWith({ mode: "keepLocal", restore: parsed.file.data })) {
              setCopies(null);
              showAlert(t.drive.copyDoneTitle, t.drive.copyDoneBody);
            }
          }),
      },
    ]);

  const setAutoSync = (autoBackup: boolean) => {
    void updateDriveState({ autoBackup }).then(() => {
      if (autoBackup) void syncNow();
    });
  };

  const disconnect = () =>
    showAlert(t.drive.signOutTitle, t.drive.signOutBody, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.drive.signOut,
        style: "destructive",
        onPress: () =>
          void run(async () => {
            await signOut().catch((e) => console.warn("Déconnexion Google :", errorLabel(e)));
            await updateDriveState({ ...DEFAULT_DRIVE_STATE });
            await storageStateStore.save({ ...DEFAULT_SYNC_STATE });
            stopSync();
            setCopies(null);
          }),
      },
    ]);

  const deleteRemote = () =>
    showAlert(t.drive.deleteTitle, t.drive.deleteBody, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: () =>
          void run(async () => {
            try {
              await driveRemote.removeAll();
            } catch (e) {
              console.warn("Suppression des données Drive impossible :", errorLabel(e));
              showAlert(t.drive.deleteErrorTitle, t.drive.deleteErrorBody);
              return;
            }
            // Synchronisation automatique coupée : rien n'est renvoyé sans le demander
            await updateDriveState({ autoBackup: false });
            await storageStateStore.save({ ...DEFAULT_SYNC_STATE });
            setCopies(null);
            markSignedIn();
            showAlert(t.drive.deletedTitle, t.drive.deletedBody);
          }),
      },
    ]);

  return {
    account: state.account,
    autoSync: state.autoBackup,
    status,
    busy: busy || status.phase === "syncing",
    connect,
    syncNow: syncManually,
    copies,
    showCopies,
    hideCopies: () => setCopies(null),
    restoreCopy,
    setAutoSync,
    disconnect,
    deleteRemote,
  };
}
