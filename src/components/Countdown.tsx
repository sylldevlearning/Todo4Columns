import { formatRemaining } from "../format";
import { useNow } from "../hooks/useNow";

// Temps restant avant endTs, calculé depuis l'horodatage de fin et rafraîchi chaque seconde
// (seul le composant qui l'utilise se re-rend). S'arrête à la fin et en arrière-plan.
export function useRemaining(endTs: number): string {
  const now = useNow(1000, endTs);
  return formatRemaining(endTs - now);
}
