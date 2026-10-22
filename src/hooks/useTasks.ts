import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { loadTasks, saveTasks } from "../storage";
import { Category, Task } from "../types";

// setTimeout ne gère pas les délais > ~24,8 jours : on plafonne et on revérifie
const MAX_TIMEOUT_MS = 60 * 60 * 1000;

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  // Empêche la sauvegarde tant que les tâches n'ont pas été chargées
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger les tâches sauvegardées au démarrage
  useEffect(() => {
    (async () => {
      try {
        setTasks(await loadTasks());
      } catch (e) {
        console.warn("Erreur récupération tâches :", e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Sauvegarder à chaque modification de la liste (une fois le chargement terminé)
  useEffect(() => {
    if (!isLoaded) return;
    saveTasks(tasks).catch((e) =>
      console.warn("Erreur sauvegarde tâches :", e)
    );
  }, [tasks, isLoaded]);

  // ---- Expiration des timers ----
  // Un seul setTimeout calé sur le prochain timer : l'état ne change que lorsqu'un timer expire
  useEffect(() => {
    const ends = tasks
      .map((t) => t.timerEnd)
      .filter((end): end is number => end !== null);
    if (ends.length === 0) return;

    const nextEnd = Math.min(...ends);
    let timeout: ReturnType<typeof setTimeout>;

    const check = () => {
      const now = Date.now();
      const expired = tasks.filter(
        (t) => t.timerEnd !== null && t.timerEnd <= now
      );
      if (expired.length === 0) {
        timeout = setTimeout(check, Math.min(nextEnd - now, MAX_TIMEOUT_MS));
        return;
      }

      const expiredIds = new Set(expired.map((t) => t.id));
      setTasks((prev) =>
        prev.map((t) => (expiredIds.has(t.id) ? { ...t, timerEnd: null } : t))
      );
      Alert.alert(
        "Temps écoulé",
        expired.length === 1
          ? `Le délai pour la tâche "${expired[0].title}" est terminé !`
          : `Le délai est terminé pour les tâches : ${expired
              .map((t) => `"${t.title}"`)
              .join(", ")}`
      );
    };

    timeout = setTimeout(
      check,
      Math.max(0, Math.min(nextEnd - Date.now(), MAX_TIMEOUT_MS))
    );
    return () => clearTimeout(timeout);
  }, [tasks]);

  const addTask = (title: string, category: Category) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      category,
      isDone: false,
      timerEnd: null,
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const toggleDone = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t))
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const startTimer = (id: string, minutes: number) => {
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, timerEnd: endTimestamp } : t))
    );
  };

  return { tasks, addTask, toggleDone, removeTask, startTimer };
}
