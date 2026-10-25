import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Completion, loadLog, pruneLog, saveLog, seedLog, updateLog } from "../completionLog";
import { Task } from "../types";
import { isForeground } from "./useForeground";
import { SAVE_DELAY_MS } from "./useTaskSaving";

// Journal des fins de tâches (bilan) : tenu à jour d'après les tâches, écritures regroupées
export function useCompletionLog(tasks: Task[], isLoaded: boolean) {
  const [completions, setCompletions] = useState<Completion[]>([]);
  // Journal lu (ou créé) : avant, rien n'est écrit pour ne pas écraser celui qui existe
  const logReadyRef = useRef(false);
  // Tâches lors du dernier passage, pour repérer celles qui viennent d'être terminées ou rouvertes
  const loggedTasksRef = useRef<Task[] | null>(null);

  // Lecture du journal, après celle des tâches
  const loadCompletions = async (loaded: Task[]) => {
    try {
      const now = Date.now();
      const saved = await loadLog();
      // Premier lancement avec le journal : rempli une seule fois avec les tâches terminées
      const log = pruneLog(saved ?? seedLog(loaded, now), now);
      if (saved === null || log !== saved) await saveLog(log);
      logReadyRef.current = true;
      setCompletions((current) => [...log, ...current]);
    } catch (e) {
      console.warn("Erreur journal des tâches terminées :", e);
    }
  };

  // Tâche terminée : ajoutée au journal ; rouverte (« Annuler ») : retirée
  useEffect(() => {
    if (!isLoaded) return;
    const previous = loggedTasksRef.current;
    loggedTasksRef.current = tasks;
    if (previous === null || previous === tasks) return;
    setCompletions((log) => pruneLog(updateLog(log, previous, tasks), Date.now()));
  }, [tasks, isLoaded]);

  // Écritures du journal regroupées comme celles des tâches (au plus une toutes les
  // SAVE_DELAY_MS) ; immédiates hors de l'écran
  const pendingLogRef = useRef<Completion[] | null>(null);
  const logTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushLog = () => {
    if (logTimerRef.current !== null) clearTimeout(logTimerRef.current);
    logTimerRef.current = null;
    const pending = pendingLogRef.current;
    if (pending === null) return;
    pendingLogRef.current = null;
    saveLog(pending).catch((e) => console.warn("Erreur sauvegarde journal :", e));
  };

  useEffect(() => {
    if (!logReadyRef.current) return;
    pendingLogRef.current = completions;
    if (!isForeground(AppState.currentState)) flushLog();
    else if (logTimerRef.current === null) logTimerRef.current = setTimeout(flushLog, SAVE_DELAY_MS);
  }, [completions]);

  // Rien ne reste en attente quand l'app quitte l'écran ou que le fournisseur est démonté
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (!isForeground(state)) flushLog();
    });
    return () => {
      subscription.remove();
      flushLog();
    };
  }, []);

  // Import d'une sauvegarde : journal remplacé
  const replaceCompletions = (log: Completion[]) => {
    loggedTasksRef.current = null;
    setCompletions(pruneLog(log, Date.now()));
  };

  return { completions, loadCompletions, replaceCompletions };
}
