import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useTasks } from "../hooks/useTasks";
import { DEFAULT_SETTINGS, loadSettings, Settings } from "../settings";

type TaskStore = ReturnType<typeof useTasks> & { settings: Settings };

const TasksContext = createContext<TaskStore | null>(null);

// Partage les tâches et les réglages entre tous les écrans
export function TasksProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((e) => console.warn("Erreur récupération réglages :", e));
  }, []);

  const store = useTasks(settings);
  return (
    <TasksContext.Provider value={{ ...store, settings }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTaskStore(): TaskStore {
  const store = useContext(TasksContext);
  if (!store) throw new Error("useTaskStore doit être utilisé dans un TasksProvider");
  return store;
}
