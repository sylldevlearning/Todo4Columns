import { useEffect } from "react";
import { AppState } from "react-native";
import { buildBackup } from "../backup";
import {
  autoBackupDue,
  backupHash,
  backupNow,
  errorLabel,
  loadDriveState,
  updateDriveState,
} from "../drive/driveBackup";
import { isDriveAvailable, NotSignedInError } from "../drive/googleAccount";
import { collectBackupContent } from "../hooks/useBackup";
import { TaskActions, useTaskActions } from "../store/TasksContext";

let inFlight = false;

// Sauvegarde automatique : quand l'app passe en arrière-plan, au plus une fois par jour et
// seulement si les données ont changé. Pas de tâche de fond : si l'envoi n'aboutit pas (hors
// ligne…), rien n'est affiché et un nouvel essai a lieu à un prochain passage en arrière-plan.
export async function runAutoBackup(actions: TaskActions, now: number = Date.now()): Promise<boolean> {
  if (inFlight) return false;
  const { isLoaded, loadError } = actions.getTasksState();
  if (!isLoaded || loadError) return false; // données pas encore lues : rien à sauvegarder
  inFlight = true;
  try {
    const state = await loadDriveState();
    if (state.account === null || !state.autoBackup) return false;
    const content = await collectBackupContent(actions);
    if (!autoBackupDue(state, backupHash(buildBackup(content, now)), now)) return false;
    await updateDriveState({ lastAttemptAt: now });
    await backupNow(content, now);
    return true;
  } catch (e) {
    // Accès retiré : plus d'essai automatique avant une nouvelle connexion
    if (e instanceof NotSignedInError) await updateDriveState({ account: null }).catch(() => {});
    else console.warn("Sauvegarde Drive automatique impossible :", errorLabel(e));
    return false;
  } finally {
    inFlight = false;
  }
}

export default function DriveAutoBackup() {
  const actions = useTaskActions();
  useEffect(() => {
    if (!isDriveAvailable()) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") void runAutoBackup(actions);
    });
    return () => subscription.remove();
  }, [actions]);
  return null;
}
