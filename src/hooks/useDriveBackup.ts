import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { showAlert } from "../appWindows";
import { BackupContent, buildBackup } from "../backup";
import {
  backupHash,
  backupNow,
  deleteAllRemoteBackups,
  DEFAULT_DRIVE_STATE,
  errorLabel,
  getDriveState,
  latestRemoteBackup,
  loadDriveState,
  readRemoteBackup,
  RemoteBackup,
  subscribeDriveState,
  updateDriveState,
} from "../drive/driveBackup";
import { NotSignedInError, signIn, signOut } from "../drive/googleAccount";
import { formatShortDate } from "../format";
import { t } from "../i18n";
import { useTaskActions } from "../store/TasksContext";
import { collectBackupContent } from "./useBackup";

type ApplyBackup = (backup: BackupContent, options?: { quiet?: boolean }) => Promise<boolean>;

// État de la sauvegarde Drive, partagé avec la sauvegarde automatique
export function useDriveState() {
  useEffect(() => {
    void loadDriveState();
  }, []);
  return useSyncExternalStore(subscribeDriveState, getDriveState);
}

// Sauvegarde Google Drive, depuis Réglages › Sauvegarde
export function useDriveBackup(applyBackup: ApplyBackup) {
  const actions = useTaskActions();
  const state = useDriveState();
  // Une seule opération à la fois (boutons désactivés pendant ce temps)
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

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

  // Accès retiré ou expiré : le compte est oublié, il faut se reconnecter
  const handleSignedOut = async (e: unknown): Promise<boolean> => {
    if (!(e instanceof NotSignedInError)) return false;
    await updateDriveState({ account: null });
    showAlert(t.drive.signedOutTitle, t.drive.signedOutBody);
    return true;
  };

  const preview = (remote: { tasks: number | null; createdAt: number }) =>
    remote.tasks === null
      ? t.drive.previewDate(formatShortDate(remote.createdAt))
      : t.backup.preview(remote.tasks, formatShortDate(remote.createdAt));

  // Télécharge, vérifie, puis remplace les données (copie de secours, notifications reprogrammées).
  // automatic : restauration sans question (app vide), avec son propre message
  const restoreNow = async (remote: RemoteBackup, automatic = false) => {
    let parsed;
    try {
      parsed = await readRemoteBackup(remote.id);
    } catch (e) {
      if (await handleSignedOut(e)) return;
      console.warn("Lecture de la sauvegarde Drive impossible :", errorLabel(e));
      showAlert(t.drive.restoreErrorTitle, t.drive.restoreErrorBody);
      return;
    }
    if (!parsed.ok) {
      if (parsed.reason === "newer") showAlert(t.backup.newerTitle, t.backup.newerBody);
      else showAlert(t.backup.invalidTitle, t.backup.invalidBody);
      return;
    }
    const { backup } = parsed;
    if (await applyBackup(backup, { quiet: automatic })) {
      // Données identiques à la sauvegarde : pas de nouvel envoi automatique tant qu'elles ne changent pas
      await updateDriveState({ lastHash: backupHash(buildBackup(backup, backup.createdAt)) });
      if (automatic) showAlert(t.driveRestore.title, t.driveRestore.body(formatShortDate(backup.createdAt)));
    }
  };
  const restoreRemote = (remote: RemoteBackup) => run(() => restoreNow(remote));

  const confirmRestore = (remote: RemoteBackup, title: string, cancel: string) =>
    showAlert(title, `${preview(remote)}\n\n${t.backup.confirmBody}`, [
      { text: cancel, style: "cancel" },
      { text: t.drive.restoreAction, style: "destructive", onPress: () => void restoreRemote(remote) },
    ]);

  // Connexion (Réglages, présentation, carte de la matrice) ; vrai si un compte est connecté.
  // Une sauvegarde existe déjà dans ce Drive (téléphone neuf ou réinstallé) : restaurée d'office
  // si l'app n'a aucune tâche, sinon proposée avec son aperçu (jamais d'écrasement silencieux).
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
      // Première sauvegarde automatique au plus tôt dans 15 min : le temps de proposer la restauration
      await updateDriveState({ ...DEFAULT_DRIVE_STATE, account, autoBackup: true, lastAttemptAt: Date.now() });
      let remote: RemoteBackup | null = null;
      try {
        remote = await latestRemoteBackup();
      } catch (e) {
        console.warn("Liste des sauvegardes Drive impossible :", errorLabel(e));
      }
      if (!remote) return;
      if (actions.getTasksState().tasks.length === 0) await restoreNow(remote, true);
      else confirmRestore(remote, t.drive.foundTitle, t.drive.later);
    });
    return connected;
  };

  const backupManually = () =>
    run(async () => {
      try {
        await backupNow(await collectBackupContent(actions), Date.now());
      } catch (e) {
        if (await handleSignedOut(e)) return;
        console.warn("Sauvegarde Drive impossible :", errorLabel(e));
        showAlert(t.drive.backupErrorTitle, t.drive.backupErrorBody);
        return;
      }
      showAlert(t.drive.backupDoneTitle, t.drive.backupDoneBody);
    });

  const restore = () =>
    run(async () => {
      let remote: RemoteBackup | null;
      try {
        remote = await latestRemoteBackup();
      } catch (e) {
        if (await handleSignedOut(e)) return;
        console.warn("Liste des sauvegardes Drive impossible :", errorLabel(e));
        showAlert(t.drive.restoreErrorTitle, t.drive.restoreErrorBody);
        return;
      }
      if (!remote) {
        showAlert(t.drive.noBackupTitle, t.drive.noBackupBody);
        return;
      }
      confirmRestore(remote, t.backup.confirmTitle, t.common.cancel);
    });

  const setAutoBackup = (autoBackup: boolean) => void updateDriveState({ autoBackup });

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
              await deleteAllRemoteBackups();
            } catch (e) {
              if (await handleSignedOut(e)) return;
              console.warn("Suppression des sauvegardes Drive impossible :", errorLabel(e));
              showAlert(t.drive.deleteErrorTitle, t.drive.deleteErrorBody);
              return;
            }
            await updateDriveState({ autoBackup: false, lastBackupAt: null, lastHash: null });
            showAlert(t.drive.deletedTitle, t.drive.deletedBody);
          }),
      },
    ]);

  return {
    account: state.account,
    autoBackup: state.autoBackup,
    lastBackupAt: state.lastBackupAt,
    busy,
    connect,
    backupNow: backupManually,
    restore,
    setAutoBackup,
    disconnect,
    deleteRemote,
  };
}
