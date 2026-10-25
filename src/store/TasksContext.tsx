import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { isForeground } from "../hooks/useForeground";
import { Escalation, SAVE_DELAY_MS, useTasks } from "../hooks/useTasks";
import { showPermissionCard } from "../notifications/permissionCard";
import { ensurePermission, PermissionState } from "../notifications/setup";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from "../settings";
import { Completion } from "../completionLog";
import { Task } from "../types";
import { createSelectableStore, SelectableStore, useStoreSelector } from "./selectableStore";

// Trois contextes : chaque écran ne se re-rend que pour ce qu'il lit.
// - tâches : lues par sélecteur (useTasksSelector)
// - actions : identité fixe, n'entraînent aucun rendu (useTaskActions)
// - réglages : lus par sélecteur (useSettings, useSettingsSelector)

export interface TasksState {
  tasks: Task[];
  isLoaded: boolean;
  completions: Completion[]; // journal des fins de tâches (bilan)
  escalation: Escalation | null; // dernière bascule automatique en Faire (« Annuler »)
  loadError: boolean; // lecture des tâches impossible
}

// Journal des fins de tâches (bilan, revue, demande d'avis)
export const selectCompletions = ({ completions }: TasksState) => completions;

type StoreActions = Omit<
  ReturnType<typeof useTasks>,
  "tasks" | "isLoaded" | "completions" | "escalation" | "loadError"
>;

export type TaskActions = StoreActions & {
  updateSettings: (settings: Settings) => void;
  // Réglages courants, lus au moment de l'action (sans s'abonner à leurs changements)
  getSettings: () => Settings;
  // À appeler quand l'utilisateur active un rappel, une relance ou la revue : fenêtre système si
  // elle peut s'afficher, sinon carte vers les réglages du téléphone ; accordée, tout est programmé
  requestNotificationPermission: () => Promise<PermissionState>;
  // Tâches et journal courants, lus au moment de l'action (export d'une sauvegarde)
  getTasksState: () => TasksState;
};

const ACTION_NAMES = [
  "addTask",
  "updateTask",
  "moveTask",
  "toggleDone",
  "completeTask",
  "snoozeTask",
  "setSnoozedUntil",
  "removeTask",
  "removeTasks",
  "restoreTasks",
  "clearDone",
  "unarchiveTask",
  "archiveTask",
  "setWeekPriorities",
  "undoEscalation",
  "dismissEscalation",
  "replaceAll",
  "retryLoad",
  "getTasksState",
  "startTimer",
  "resyncNotifications",
  "updateSettings",
  "getSettings",
  "requestNotificationPermission",
] as const satisfies readonly (keyof TaskActions)[];

const TasksStateContext = createContext<SelectableStore<TasksState> | null>(null);
const TaskActionsContext = createContext<TaskActions | null>(null);
const SettingsContext = createContext<SelectableStore<Settings> | null>(null);
// Lecture des réglages enregistrés terminée : avant, seuls les réglages par défaut sont connus
const SettingsReadyContext = createContext(false);

// Partage les tâches et les réglages entre tous les écrans
export function TasksProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Lecture des réglages terminée (réussie ou non) : les notifications peuvent être programmées
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e) => console.warn("Erreur récupération réglages :", e))
      .finally(() => setSettingsReady(true));
  }, []);

  const store = useTasks(settings, undefined, settingsReady);

  // Réglages modifiés à la suite (pastilles, heure, interrupteurs) : une seule écriture par
  // SAVE_DELAY_MS ; immédiate hors de l'écran, et rien ne reste en attente au démontage
  const pendingSettingsRef = useRef<Settings | null>(null);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSettings = () => {
    if (settingsTimerRef.current !== null) clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = null;
    const pending = pendingSettingsRef.current;
    if (pending === null) return;
    pendingSettingsRef.current = null;
    saveSettings(pending).catch((e) => console.warn("Erreur sauvegarde réglages :", e));
  };
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (!isForeground(state)) flushSettings();
    });
    return () => {
      subscription.remove();
      flushSettings();
    };
  }, []);

  const [tasksStore] = useState(() =>
    createSelectableStore<TasksState>({
      tasks: store.tasks,
      isLoaded: store.isLoaded,
      completions: store.completions,
      escalation: store.escalation,
      loadError: store.loadError,
    })
  );
  const [settingsStore] = useState(() => createSelectableStore(settings));

  // Publié avant l'affichage : les écrans abonnés se mettent à jour dans le même passage
  useLayoutEffect(() => {
    tasksStore.set({
      tasks: store.tasks,
      isLoaded: store.isLoaded,
      completions: store.completions,
      escalation: store.escalation,
      loadError: store.loadError,
    });
  }, [tasksStore, store.tasks, store.isLoaded, store.completions, store.escalation, store.loadError]);
  useLayoutEffect(() => settingsStore.set(settings), [settingsStore, settings]);

  // Dernières versions des fonctions, appelées par les actions à identité fixe
  const latest = useRef<TaskActions>(null!);
  latest.current = {
    ...store,
    updateSettings: (next: Settings) => {
      setSettings(next);
      pendingSettingsRef.current = next;
      if (!isForeground(AppState.currentState)) flushSettings();
      else if (settingsTimerRef.current === null) {
        settingsTimerRef.current = setTimeout(flushSettings, SAVE_DELAY_MS);
      }
    },
    getSettings: () => settingsStore.get(),
    getTasksState: () => tasksStore.get(),
    requestNotificationPermission: async () => {
      const { state, asked } = await ensurePermission();
      if (state === "granted") latest.current.resyncNotifications();
      // Refusée et fenêtre système plus disponible : seule la carte peut aider
      else if (state === "denied" && !asked) showPermissionCard();
      return state;
    },
  };

  const actions = useMemo(
    () =>
      Object.fromEntries(
        ACTION_NAMES.map((name) => [
          name,
          (...args: unknown[]) => (latest.current[name] as (...a: unknown[]) => unknown)(...args),
        ])
      ) as TaskActions,
    []
  );

  return (
    <TasksStateContext.Provider value={tasksStore}>
      <TaskActionsContext.Provider value={actions}>
        <SettingsContext.Provider value={settingsStore}>
          <SettingsReadyContext.Provider value={settingsReady}>{children}</SettingsReadyContext.Provider>
        </SettingsContext.Provider>
      </TaskActionsContext.Provider>
    </TasksStateContext.Provider>
  );
}

function useRequired<T>(value: T | null): T {
  if (value === null) throw new Error("À utiliser dans un TasksProvider");
  return value;
}

// Partie des tâches lue par un écran ; isEqual évite un rendu quand elle n'a pas changé
export function useTasksSelector<S>(
  selector: (state: TasksState) => S,
  isEqual?: (a: S, b: S) => boolean
): S {
  return useStoreSelector(useRequired(useContext(TasksStateContext)), selector, isEqual);
}

// Actions sur les tâches et les réglages : identité fixe, aucun rendu
export function useTaskActions(): TaskActions {
  return useRequired(useContext(TaskActionsContext));
}

export function useSettingsSelector<S>(
  selector: (settings: Settings) => S,
  isEqual?: (a: S, b: S) => boolean
): S {
  return useStoreSelector(useRequired(useContext(SettingsContext)), selector, isEqual);
}

const allSettings = (settings: Settings) => settings;
export const useSettings = (): Settings => useSettingsSelector(allSettings);

export const useSettingsReady = (): boolean => useContext(SettingsReadyContext);
