import { Alert } from "react-native";
import {
  BackupContent,
  backupFileName,
  buildBackup,
  parseBackup,
  pickBackupText,
  savePreImportCopy,
  shareBackupFile,
  writeImported,
} from "../backup";
import { formatShortDate } from "../format";
import { t } from "../i18n";
import { loadReviewWeeks } from "../review";
import { useTaskActions } from "../store/TasksContext";

// Export et import de la sauvegarde, depuis les Réglages
export function useBackup() {
  const actions = useTaskActions();

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
      Alert.alert(t.backup.exportErrorTitle, t.backup.exportErrorBody);
    }
  };

  // Copie de secours, écriture, puis remplacement en mémoire (notifications reprogrammées)
  const apply = async (backup: BackupContent) => {
    try {
      await savePreImportCopy(Date.now());
      await writeImported(backup);
    } catch (e) {
      console.warn("Erreur import :", e);
      Alert.alert(t.backup.importErrorTitle, t.backup.importErrorBody);
      return;
    }
    actions.replaceAll(backup);
    actions.updateSettings(backup.settings);
    Alert.alert(t.backup.doneTitle, t.backup.doneBody(backup.tasks.length));
  };

  // Choix du fichier, vérification, aperçu et confirmation ; rien n'est touché avant
  const importData = async () => {
    let text: string | null;
    try {
      text = await pickBackupText();
    } catch (e) {
      console.warn("Erreur lecture sauvegarde :", e);
      Alert.alert(t.backup.invalidTitle, t.backup.invalidBody);
      return;
    }
    if (text === null) return; // annulé

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      if (parsed.reason === "newer") Alert.alert(t.backup.newerTitle, t.backup.newerBody);
      else Alert.alert(t.backup.invalidTitle, t.backup.invalidBody);
      return;
    }
    const { backup } = parsed;
    Alert.alert(
      t.backup.confirmTitle,
      `${t.backup.preview(backup.tasks.length, formatShortDate(backup.createdAt))}\n\n${t.backup.confirmBody}`,
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.backup.replace, style: "destructive", onPress: () => apply(backup) },
      ]
    );
  };

  return { exportData, importData };
}
