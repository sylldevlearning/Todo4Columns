import { Dispatch, SetStateAction, useEffect } from "react";

import { t } from "../i18n";
import { Task } from "../types";
import { showAlert } from "../appWindows";

// setTimeout ne gère pas les délais > ~24,8 jours : on plafonne et on revérifie
export const MAX_TIMEOUT_MS = 60 * 60 * 1000;

// Minuteurs des tâches : démarrage, et fin signalée par une alerte quand l'app est à l'écran.
// updateOne : modification d'une tâche avec mise à jour de updatedAt (useTasks)
export function useTimers(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  foreground: boolean,
  updateOne: (id: string, change: (t: Task) => Task) => void
) {
  // Un seul setTimeout calé sur le prochain timer : l'état ne change que lorsqu'un timer expire.
  // Arrêté en arrière-plan (la notification du minuteur prévient) ; revérifié au retour.
  useEffect(() => {
    if (!foreground) return;
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
        prev.map((t) =>
          expiredIds.has(t.id)
            ? { ...t, timerEnd: null, updatedAt: Date.now() }
            : t
        )
      );
      showAlert(
        t.timer.expiredTitle,
        expired.length === 1
          ? t.timer.expiredOne(expired[0].title)
          : t.timer.expiredMany(expired.map((task) => task.title))
      );
    };

    timeout = setTimeout(
      check,
      Math.max(0, Math.min(nextEnd - Date.now(), MAX_TIMEOUT_MS))
    );
    return () => clearTimeout(timeout);
  }, [tasks, foreground]);

  const startTimer = (id: string, minutes: number) => {
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    updateOne(id, (t) => ({ ...t, timerEnd: endTimestamp }));
  };

  return { startTimer };
}
