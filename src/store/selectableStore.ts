import { useRef, useSyncExternalStore } from "react";

// Valeur partagée à laquelle les composants s'abonnent par sélecteur :
// un composant ne se re-rend que si la partie qu'il lit change
export interface SelectableStore<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSelectableStore<T>(initial: T): SelectableStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Même tableau, élément par élément (les tâches non modifiées gardent leur identité)
export function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
}

// Lit store via selector ; la valeur précédente est gardée tant que isEqual la juge identique
export function useStoreSelector<T, S>(
  store: SelectableStore<T>,
  selector: (value: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is
): S {
  const cache = useRef<{ source: T; selector: (value: T) => S; selected: S } | null>(null);

  const getSnapshot = () => {
    const source = store.get();
    const previous = cache.current;
    if (previous && previous.source === source && previous.selector === selector) {
      return previous.selected;
    }
    const next = selector(source);
    const selected = previous && isEqual(previous.selected, next) ? previous.selected : next;
    cache.current = { source, selector, selected };
    return selected;
  };

  return useSyncExternalStore(store.subscribe, getSnapshot);
}
