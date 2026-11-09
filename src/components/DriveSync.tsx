import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { isDriveAvailable } from "../drive/googleAccount";
import { subscribeReviews } from "../review";
import { TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { configureSync, createLocalSide, flushSync, scheduleSync, syncNow, syncOnOpen } from "../sync/controller";
import { storageStateStore } from "../sync/engine";
import { driveRemote } from "../sync/remote";

const selectReady = ({ isLoaded, loadError }: TasksState) => isLoaded && !loadError;
const selectTasks = ({ tasks }: TasksState) => tasks;
const selectCompletions = ({ completions }: TasksState) => completions;

// Déclencheurs de la synchronisation Google Drive (Android, compte connecté) : à l'ouverture de
// l'app, 10 s après le dernier changement, au passage en arrière-plan et au retour dans l'app.
// Rien n'est affiché ici : l'état est dans l'icône nuage de la matrice.
export default function DriveSync() {
  const actions = useTaskActions();
  const ready = useTasksSelector(selectReady);
  const tasks = useTasksSelector(selectTasks);
  const completions = useTasksSelector(selectCompletions);
  const configured = useRef(false);

  useEffect(() => {
    if (!isDriveAvailable()) return;
    void configureSync({
      remote: driveRemote,
      store: storageStateStore,
      local: createLocalSide(actions),
      canSync: () => {
        const { isLoaded, loadError } = actions.getTasksState();
        return isLoaded && !loadError;
      },
    });
    configured.current = true;
    return () => {
      configured.current = false;
      void configureSync(null);
    };
  }, [actions]);

  // Ouverture de l'app : dès que les tâches sont lues
  useEffect(() => {
    if (ready && configured.current) void syncNow();
  }, [ready]);

  // Changement des tâches, du journal ou des revues : synchronisation 10 s après le dernier
  const first = useRef(true);
  useEffect(() => {
    if (!ready || !configured.current) return;
    if (first.current) {
      first.current = false; // lecture au démarrage : pas un changement
      return;
    }
    scheduleSync();
  }, [ready, tasks, completions]);
  useEffect(() => subscribeReviews(() => scheduleSync()), []);

  useEffect(() => {
    if (!isDriveAvailable()) return;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") void flushSync();
      else if (next === "active") void syncOnOpen();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
