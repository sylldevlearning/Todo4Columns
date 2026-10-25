import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { isForeground } from "./useForeground";

// Heure courante, rafraîchie à intervalle régulier (délais affichés, tâches en attente).
// Rien ne tourne quand l'app n'est pas à l'écran ; au retour, l'heure est relue aussitôt.
// until : plus de rafraîchissement une fois cette date passée (fin d'un minuteur)
export function useNow(intervalMs: number = 30 * 1000, until?: number): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const ended = () => until !== undefined && Date.now() >= until;

    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const tick = () => {
      setNow(Date.now());
      if (ended()) stop();
    };
    const start = () => {
      if (id === null && !ended()) id = setInterval(tick, intervalMs);
    };

    if (isForeground(AppState.currentState)) start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (isForeground(state)) {
        tick();
        start();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [intervalMs, until]);

  return now;
}
