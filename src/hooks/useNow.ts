import { useEffect, useState } from "react";

// Heure courante, rafraîchie à intervalle régulier (délais affichés, tâches en attente)
export function useNow(intervalMs: number = 30 * 1000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
