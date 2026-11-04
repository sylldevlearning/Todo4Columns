import { useEffect, useState } from "react";

import {
  BackupContent,
  BackupTooLargeError,
  backupFileName,
  buildBackup,
  parseBackup,
  pickBackupText,
  preImportCopyDate,
  readPreImportCopy,
  removePreImportCopy,
  savePreImportCopy,
  shareBackupFile,
  writeImported,
} from "../backup";
import { formatShortDate } from "../format";
import { t } from "../i18n";
import { loadReviewWeeks } from "../review";
import { noteUndo } from "../reviewPrompt";
import { useTaskActions } from "../store/TasksContext";
import { showAlert } from "../appWindows";

// Export et import de la sauvegarde, depuis les Réglages
export function useBackup() {
  const actions = useTaskActions();
  // Date du dernier import annulable (copie de secours présente), ou null
  const [lastImport, setLastImport] = useState<number | null>(null);

  useEffect(() => {
    preImportCopyDate()
      .then(setLastImport)
      .catch(() => setLastImport(null));
  }, []);

  // Remplace les données en mémoire ; toutes les notifications sont réconciliées
  const replaceInMemory = (content: BackupContent) => {
    actions.replaceAll(content);
    actions.updateSettings(content.settings);
  };

  const exportData = async () => {
    try {
      const now = Date.now();
      const { tasks, completions } = actions.getTasksState();
      const file = buildBackup(
        { tasks, completions, settings: actions.getSettings(), reviewWeeks: await loadReviewWeeks() },
        now
      );
      await shareBackupFile(file, backupFileName(now, t.backup.filePrefix), t.backup.exportTitle);
    } catch (e) {
      console.warn("Erreur export :", e);
      showAlert(t.backup.exportErrorTitle, t.backup.exportErrorBody);
    }
  };

  // Copie de secours, écriture, puis remplacement en mémoire (notifications reprogrammées)
  const apply = async (backup: BackupContent) => {
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
      return;
    }
    replaceInMemory(backup);
    setLastImport(Date.now());
    showAlert(t.backup.doneTitle, t.backup.doneBody(backup.tasks.length));
  };

  // « Annuler le dernier import » : les données d'avant reviennent, la copie est supprimée
  const restore = async () => {
    noteUndo();
    try {
      const previous = await readPreImportCopy();
      await writeImported(previous);
      await removePreImportCopy();
      replaceInMemory(previous);
    } catch (e) {
      console.warn("Erreur restauration :", e);
      showAlert(t.backup.undoErrorTitle, t.backup.undoErrorBody);
      return;
    }
    setLastImport(null);
    showAlert(t.backup.undoneTitle, t.backup.undoneBody);
  };

  const undoImport = () => {
    if (lastImport === null) return;
    showAlert(t.backup.undoConfirmTitle, t.backup.undoConfirmBody(formatShortDate(lastImport)), [
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
        { text: t.backup.replace, style: "destructive", onPress: () => apply(backup) },
      ]
    );
  };

  return { exportData, importData, canUndoImport: lastImport !== null, undoImport };
}
