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
import { useTasks } from "../hooks/useTasks";
import { ensurePermission, PermissionState } from "../notifications/setup";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from "../settings";
import { Task } from "../types";
import { createSelectableStore, SelectableStore, useStoreSelector } from "./selectableStore";

// Trois contextes : chaque écran ne se re-rend que pour ce qu'il lit.
// - tâches : lues par sélecteur (useTasksSelector)
// - actions : identité fixe, n'entraînent aucun rendu (useTaskActions)
// - réglages : lus par sélecteur (useSettings, useSettingsSelector)

export interface TasksState {
  tasks: Task[];
  isLoaded: boolean;
}

type StoreActions = Omit<ReturnType<typeof useTasks>, "tasks" | "isLoaded">;

export type TaskActions = StoreActions & {
  updateSettings: (settings: Settings) => void;
  // Réglages courants, lus au moment de l'action (sans s'abonner à leurs changements)
  getSettings: () => Settings;
  // À appeler au premier rappel créé : demande l'autorisation si besoin, puis programme tout
  requestNotificationPermission: () => Promise<PermissionState>;
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

  const [tasksStore] = useState(() =>
    createSelectableStore<TasksState>({ tasks: store.tasks, isLoaded: store.isLoaded })
  );
  const [settingsStore] = useState(() => createSelectableStore(settings));

  // Publié avant l'affichage : les écrans abonnés se mettent à jour dans le même passage
  useLayoutEffect(() => {
    tasksStore.set({ tasks: store.tasks, isLoaded: store.isLoaded });
  }, [tasksStore, store.tasks, store.isLoaded]);
  useLayoutEffect(() => settingsStore.set(settings), [settingsStore, settings]);

  // Dernières versions des fonctions, appelées par les actions à identité fixe
  const latest = useRef<TaskActions>(null!);
  latest.current = {
    ...store,
    updateSettings: (next: Settings) => {
      setSettings(next);
      saveSettings(next).catch((e) => console.warn("Erreur sauvegarde réglages :", e));
    },
    getSettings: () => settingsStore.get(),
    requestNotificationPermission: async () => {
      const state = await ensurePermission();
      if (state === "granted") latest.current.resyncNotifications();
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
