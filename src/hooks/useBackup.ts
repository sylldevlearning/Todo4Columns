import { useEffect, useState } from "react";

import {
  BackupContent,
  BackupTooLargeError,
  backupFileName,
  buildBackup,
  parseBackup,
  pickBackupText,
  PreImportCopyInfo,
  preImportCopyInfo,
  readPreImportCopy,
  removePreImportCopy,
  savePreImportCopy,
  shareBackupFile,
  subscribePreImportCopy,
  writeImported,
} from "../backup";
import { formatShortDate } from "../format";
import { t } from "../i18n";
import { loadReviewWeeks, saveReviewWeeks } from "../review";
import { noteUndo } from "../reviewPrompt";
import { TaskActions, useTaskActions } from "../store/TasksContext";
import { showAlert } from "../appWindows";

// Données à sauvegarder, lues au moment de la sauvegarde (export ou Google Drive)
export async function collectBackupContent(actions: TaskActions): Promise<Omit<BackupContent, "createdAt">> {
  const { tasks, completions } = actions.getTasksState();
  return { tasks, completions, settings: actions.getSettings(), reviewWeeks: await loadReviewWeeks() };
}

// Export et import de la sauvegarde, depuis les Réglages
export function useBackup() {
  const actions = useTaskActions();
  // Dernier import annulable (copie de secours présente : date et origine), ou null
  const [lastImport, setLastImport] = useState<PreImportCopyInfo | null>(null);

  // Relu au montage et à chaque copie créée ou supprimée (aussi par la synchronisation)
  useEffect(() => {
    let active = true;
    const refresh = () =>
      preImportCopyInfo()
        .then((info) => active && setLastImport(info))
        .catch(() => active && setLastImport(null));
    refresh();
    const unsubscribe = subscribePreImportCopy(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Remplace les données en mémoire ; toutes les notifications sont réconciliées
  const replaceInMemory = (content: BackupContent) => {
    actions.replaceAll(content);
    actions.updateSettings(content.settings);
  };

  const exportData = async () => {
    try {
      const now = Date.now();
      const file = buildBackup(await collectBackupContent(actions), now);
      await shareBackupFile(file, backupFileName(now, t.backup.filePrefix), t.backup.exportTitle);
    } catch (e) {
      console.warn("Erreur export :", e);
      showAlert(t.backup.exportErrorTitle, t.backup.exportErrorBody);
    }
  };

  // Copie de secours, écriture, puis remplacement en mémoire (notifications reprogrammées).
  // Vrai si les données ont été remplacées. Utilisé aussi par la restauration Google Drive.
  // quiet : pas de message « Sauvegarde importée » (la restauration automatique a le sien)
  const apply = async (backup: BackupContent, { quiet = false }: { quiet?: boolean } = {}): Promise<boolean> => {
    let copied = false;
    try {
      await savePreImportCopy(Date.now());
      copied = true;
      await writeImported(backup);
    } catch (e) {
      console.warn("Erreur import :", e);
      // Aucun import n'a eu lieu : la copie ne doit pas proposer « Annuler le dernier import »
      if (copied) await removePreImportCopy().catch(() => {});
      showAlert(t.backup.importErrorTitle, t.backup.importErrorBody);
      return false;
    }
    replaceInMemory(backup);
    if (!quiet) showAlert(t.backup.doneTitle, t.backup.doneBody(backup.tasks.length));
    return true;
  };

  // Copie venue de la synchronisation : les données d'avant sont fusionnées avec les actuelles,
  // sans pierre tombale (rien n'est supprimé, ni ici ni sur les autres téléphones). Les tâches
  // d'avant absentes maintenant reviennent comme les plus récentes, même si l'action de
  // synchronisation les avait supprimées partout.
  const restoreByMerge = async () => {
    const previous = await readPreImportCopy();
    const now = Date.now();
    const present = new Set(actions.getTasksState().tasks.map((t) => t.id));
    await actions.applySynced({
      tasks: previous.tasks.map((t) => (present.has(t.id) ? t : { ...t, modifiedAt: now })),
      deleted: [],
      completions: previous.completions,
      removedCompletions: [],
      reviewWeeks: previous.reviewWeeks,
    });
    await saveReviewWeeks([...(await loadReviewWeeks()), ...previous.reviewWeeks]);
    await removePreImportCopy();
  };

  // « Annuler le dernier import » : les données d'avant reviennent, la copie est supprimée
  const restore = async () => {
    noteUndo();
    try {
      if (lastImport?.origin === "sync") {
        await restoreByMerge();
      } else {
        const previous = await readPreImportCopy();
        await writeImported(previous);
        await removePreImportCopy();
        replaceInMemory(previous);
      }
    } catch (e) {
      console.warn("Erreur restauration :", e);
      showAlert(t.backup.undoErrorTitle, t.backup.undoErrorBody);
      return;
    }
    showAlert(t.backup.undoneTitle, t.backup.undoneBody);
  };

  const undoImport = () => {
    if (lastImport === null) return;
    const date = formatShortDate(lastImport.createdAt);
    const body = lastImport.origin === "sync" ? t.backup.undoSyncConfirmBody(date) : t.backup.undoConfirmBody(date);
    showAlert(t.backup.undoConfirmTitle, body, [
      { text: t.common.cancel, style: "cancel" },
      { text: t.backup.undoAction, style: "destructive", onPress: restore },
    ]);
  };

  // Choix du fichier, vérification, aperçu et confirmation ; rien n'est touché avant
  const importData = async () => {
    let text: string | null;
    try {
      text = await pickBackupText();
    } catch (e) {
      if (e instanceof BackupTooLargeError) {
        showAlert(t.backup.tooLargeTitle, t.backup.tooLargeBody);
        return;
      }
      console.warn("Erreur lecture sauvegarde :", e);
      showAlert(t.backup.invalidTitle, t.backup.invalidBody);
      return;
    }
    if (text === null) return; // annulé

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      if (parsed.reason === "newer") showAlert(t.backup.newerTitle, t.backup.newerBody);
      else if (parsed.reason === "tooLarge") showAlert(t.backup.tooLargeTitle, t.backup.tooLargeBody);
      else showAlert(t.backup.invalidTitle, t.backup.invalidBody);
      return;
    }
    const { backup } = parsed;
    showAlert(
      t.backup.confirmTitle,
      `${t.backup.preview(backup.tasks.length, formatShortDate(backup.createdAt))}\n\n${t.backup.confirmBody}`,
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.backup.replace, style: "destructive", onPress: () => void apply(backup) },
      ]
    );
  };

  return { exportData, importData, canUndoImport: lastImport !== null, undoImport, applyBackup: apply };
}
