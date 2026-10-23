import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { ensurePermission, PermissionState } from "../notifications/setup";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from "../settings";

type TaskStore = ReturnType<typeof useTasks> & {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  // À appeler au premier rappel créé : demande l'autorisation si besoin, puis programme tout
  requestNotificationPermission: () => Promise<PermissionState>;
};

const TasksContext = createContext<TaskStore | null>(null);

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

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next).catch((e) => console.warn("Erreur sauvegarde réglages :", e));
  };

  const requestNotificationPermission = async () => {
    const state = await ensurePermission();
    if (state === "granted") store.resyncNotifications();
    return state;
  };

  return (
    <TasksContext.Provider
      value={{ ...store, settings, updateSettings, requestNotificationPermission }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTaskStore(): TaskStore {
  const store = useContext(TasksContext);
  if (!store) throw new Error("useTaskStore doit être utilisé dans un TasksProvider");
  return store;
}
