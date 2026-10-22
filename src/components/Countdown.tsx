import { useEffect, useState } from "react";
import { formatRemaining } from "../format";

// Temps restant avant endTs, rafraîchi chaque seconde : seul le composant qui l'utilise se re-rend
export function useRemaining(endTs: number): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return formatRemaining(endTs - now);
}
