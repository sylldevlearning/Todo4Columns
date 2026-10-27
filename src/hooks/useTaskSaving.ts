import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { saveTasks } from "../storage";
import { Task } from "../types";
import { SAVE_DELAY_MS } from "./batching";
import { isForeground } from "./useForeground";


// Sauvegarde de chaque modification de la liste (une fois le chargement terminé), au plus une
// écriture toutes les SAVE_DELAY_MS. Hors de l'écran, écriture immédiate : les minuteries
// peuvent y être suspendues et l'app arrêtée à tout moment.
export function useTaskSaving(tasks: Task[], isLoaded: boolean): void {
  // Liste à écrire et écriture programmée
  const pendingSaveRef = useRef<Task[] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = () => {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const pending = pendingSaveRef.current;
    if (pending === null) return;
    pendingSaveRef.current = null;
    saveTasks(pending).catch((e) => console.warn("Erreur sauvegarde tâches :", e));
  };

  useEffect(() => {
    if (!isLoaded) return;
    pendingSaveRef.current = tasks;
    if (!isForeground(AppState.currentState)) flushSave();
    else if (saveTimerRef.current === null) {
      saveTimerRef.current = setTimeout(flushSave, SAVE_DELAY_MS);
    }
  }, [tasks, isLoaded]);

  // Rien ne reste en attente quand l'app quitte l'écran ou que le fournisseur est démonté
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (!isForeground(state)) flushSave();
    });
    return () => {
      subscription.remove();
      flushSave();
    };
  }, []);
}
