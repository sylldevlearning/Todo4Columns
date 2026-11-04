import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Notifier } from "../notifications/service";
import { notificationSettingsKey, Settings } from "../settings";
import { Task } from "../types";

// Tout ce qui influence les notifications d'une tâche (sauf leurs identifiants et la priorité)
const scheduleSignature = (task: Task) =>
  JSON.stringify({ ...task, notificationIds: undefined, priorityWeek: undefined });

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

interface Options {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  tasksRef: MutableRefObject<Task[]>;
  settings: Settings;
  settingsRef: MutableRefObject<Settings>;
  isLoaded: boolean;
  settingsReady: boolean; // réglages enregistrés lus ; aucune notification n'est programmée avant
  notifier: Notifier;
}

// Synchronisation des notifications avec les tâches et les réglages des rappels
export function useNotificationSync({
  tasks,
  setTasks,
  tasksRef,
  settings,
  settingsRef,
  isLoaded,
  settingsReady,
  notifier,
}: Options) {
  // Signatures déjà synchronisées (null avant la première réconciliation)
  const syncedRef = useRef<Map<string, string> | null>(null);
  // Identifiants programmés connus pour chaque tâche
  const idsRef = useRef(new Map<string, string[]>());
  // Réglages des rappels utilisés par la dernière réconciliation complète
  const reconciledKeyRef = useRef<string | null>(null);
  // Les synchronisations s'exécutent l'une après l'autre
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueue = (job: () => Promise<void>) => {
    queueRef.current = queueRef.current
      .then(job)
      .catch((e) => console.warn("Erreur notifications :", e));
  };

  // Enregistre les nouveaux identifiants dans les tâches (sans toucher à leur signature)
  const applyIds = (idsByTask: Record<string, string[]>) => {
    for (const [id, ids] of Object.entries(idsByTask)) idsRef.current.set(id, ids);
    setTasks((prev) =>
      prev.some((t) => idsByTask[t.id] && !sameIds(t.notificationIds, idsByTask[t.id]))
        ? prev.map((t) =>
            idsByTask[t.id] && !sameIds(t.notificationIds, idsByTask[t.id])
              ? { ...t, notificationIds: idsByTask[t.id] }
              : t
          )
        : prev
    );
  };

  // Annule les orphelines et reprogramme ce qui manque, pour toutes les tâches
  const reconcileAll = () => {
    reconciledKeyRef.current = notificationSettingsKey(settingsRef.current);
    enqueue(async () => {
      applyIds(await notifier.reconcile(tasksRef.current, settingsRef.current));
    });
  };

  // Tâches remplacées (import) : tout sera réconcilié au passage suivant, comme au démarrage
  const resetSync = () => {
    syncedRef.current = null;
    idsRef.current = new Map();
  };

  // Ajout, modification, déplacement, coche, suppression, annulation, restauration :
  // toute tâche dont la signature change est resynchronisée, toute tâche disparue est annulée.
  useEffect(() => {
    // La première réconciliation attend les réglages enregistrés : sinon elle programmerait
    // avec les réglages par défaut, puis tout serait annulé et reprogrammé
    if (!isLoaded || !settingsReady) return;
    const signatures = new Map(tasks.map((t) => [t.id, scheduleSignature(t)]));
    const previous = syncedRef.current;
    syncedRef.current = signatures;

    // Premier passage après le chargement : réconciliation complète
    if (previous === null) {
      reconcileAll();
      return;
    }

    const changed = tasks.filter((t) => previous.get(t.id) !== signatures.get(t.id));
    const removedIds = [...previous.keys()].filter((id) => !signatures.has(id));
    if (changed.length === 0 && removedIds.length === 0) return;

    enqueue(async () => {
      for (const id of removedIds) {
        await notifier.cancel(idsRef.current.get(id) ?? []);
        idsRef.current.delete(id);
      }
      const result: Record<string, string[]> = {};
      let truncated = false;
      for (const task of changed) {
        const known = idsRef.current.get(task.id) ?? task.notificationIds;
        result[task.id] = await notifier.syncTask(
          { ...task, notificationIds: known },
          settingsRef.current,
          undefined,
          () => (truncated = true)
        );
        idsRef.current.set(task.id, result[task.id]);
      }
      applyIds(result);
      // Plafond de 64 atteint : réconciliation complète, pour garder les plus proches
      if (truncated) reconcileAll();
    });
  }, [tasks, isLoaded, settingsReady]);

  // Réglages des rappels modifiés : tout est reprogrammé. Les autres réglages (animations,
  // archivage) et la relecture de réglages identiques au démarrage ne déclenchent rien.
  const notificationKey = notificationSettingsKey(settings);
  useEffect(() => {
    if (syncedRef.current !== null && notificationKey !== reconciledKeyRef.current) reconcileAll();
  }, [notificationKey]);

  // À chaque retour dans l'app : reprogramme les notifications suivantes (limite iOS de 64)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && syncedRef.current !== null) reconcileAll();
    });
    return () => subscription.remove();
  }, []);

  return { reconcileAll, resetSync };
}
