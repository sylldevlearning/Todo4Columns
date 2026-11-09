import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Completion, loadLog, pruneLog, saveLog, seedLog, updateLog } from "../completionLog";
import { noteLogAddition, noteLogRemoval } from "../sync/localChanges";
import { EMPTY_SYNC_DATA, mergeData, RemovedCompletion } from "../sync/merge";
import { Task } from "../types";
import { isForeground } from "./useForeground";
import { SAVE_DELAY_MS } from "./batching";

// Journal des fins de tâches (bilan) : tenu à jour d'après les tâches, écritures regroupées
export function useCompletionLog(tasks: Task[], isLoaded: boolean) {
  const [completions, setCompletions] = useState<Completion[]>([]);
  // Dernier journal rendu (synchronisation : écriture immédiate du journal fusionné)
  const completionsRef = useRef(completions);
  completionsRef.current = completions;
  // Journal lu (ou créé) : avant, rien n'est écrit pour ne pas écraser celui qui existe, et la
  // synchronisation attend (un journal vide n'est pas un journal lu)
  const logReadyRef = useRef(false);
  const [logReady, setLogReady] = useState(false);
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
      setLogReady(true);
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
    setCompletions((log) =>
      pruneLog(
        updateLog(log, previous, tasks, {
          onRemoved: (key) => noteLogRemoval(key, Date.now()),
          onAdded: noteLogAddition,
        }),
        Date.now()
      )
    );
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

  // Synchronisation : journal reçu fusionné avec celui-ci (ou le remplaçant), sans les entrées
  // retirées. Les tâches terminées sur un autre téléphone ne sont pas ajoutées une deuxième fois :
  // updateLog n'ajoute pas une entrée déjà présente. Le journal obtenu est écrit tout de suite
  // (promesse renvoyée) : la synchronisation n'enregistre son état qu'après.
  const mergeCompletions = async (
    entries: Completion[],
    removed: RemovedCompletion[],
    replace: boolean
  ): Promise<Completion[]> => {
    const now = Date.now();
    const compute = (current: Completion[]) =>
      pruneLog(
        replace
          ? entries
          : mergeData(
              { ...EMPTY_SYNC_DATA, completions: current },
              { ...EMPTY_SYNC_DATA, completions: entries, removedCompletions: removed },
              now
            ).completions,
        now
      );
    const next = compute(completionsRef.current);
    setCompletions(compute);
    await saveLog(next);
    return next;
  };

  return { completions, logReady, loadCompletions, replaceCompletions, mergeCompletions };
}
