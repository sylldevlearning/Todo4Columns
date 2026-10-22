import { t } from "../i18n";
import { Category } from "../types";

// Index tiré au hasard dans [0, count[, différent de `previous` dès qu'il y a au moins deux choix
export function pickIndex(
  count: number,
  previous: number | null,
  random: () => number = Math.random
): number {
  if (count <= 1) return 0;
  if (previous === null || previous < 0 || previous >= count) {
    return Math.floor(random() * count);
  }
  // Tirage parmi les count - 1 autres index
  const index = Math.floor(random() * (count - 1));
  return index >= previous ? index + 1 : index;
}

// Tire les messages d'un quadrant sans jamais répéter deux fois de suite le même
export function createMessagePicker(
  messages: Record<Category, string[]> = t.celebrations,
  random: () => number = Math.random
) {
  const last: Partial<Record<Category, number>> = {};
  return (category: Category): string => {
    const list = messages[category];
    const index = pickIndex(list.length, last[category] ?? null, random);
    last[category] = index;
    return list[index];
  };
}
