import { useCallback, useRef } from "react";

// Fonction à identité fixe qui appelle toujours la dernière version de fn :
// la passer à un composant mémoïsé ne le fait pas se re-rendre à chaque rendu du parent
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback((...args: A) => latest.current(...args), []);
}
