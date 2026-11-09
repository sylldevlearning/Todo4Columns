import { t } from "../i18n";
import { palette } from "../theme";
import { Category } from "../types";

export interface CategoryInfo {
  key: Category; // clé enregistrée dans AsyncStorage : NE PAS MODIFIER
  name: string; // « Faire » / « Do »
  subtitle: string; // « Maintenant »
  axisLabel: string; // « Urgent et important »
  description: string; // phrase affichée dans la fiche de création
  urgent: boolean;
  important: boolean;
  color: string; // couleur du quadrant (thème courant)
  textColor: string; // texte coloré sur le fond de l'app (thème courant)
  onColor: string; // texte posé sur la couleur du quadrant (thème courant)
}

type CategoryFlags = Pick<CategoryInfo, "key" | "urgent" | "important">;

// Quadrant dont les textes (langue courante) et les couleurs (thème courant, src/theme.ts) sont lus
// à chaque accès
const category = (info: CategoryFlags): CategoryInfo =>
  Object.defineProperties({ ...info } as CategoryInfo, {
    name: { get: () => t.categories[info.key].name, enumerable: true },
    subtitle: { get: () => t.categories[info.key].subtitle, enumerable: true },
    axisLabel: { get: () => t.categories[info.key].axisLabel, enumerable: true },
    description: { get: () => t.categories[info.key].description, enumerable: true },
    color: { get: () => palette().quadrants[info.key].color, enumerable: true },
    textColor: { get: () => palette().quadrants[info.key].textColor, enumerable: true },
    onColor: { get: () => palette().quadrants[info.key].onColor, enumerable: true },
  });

// Ordre de la grille : ligne « Important » puis « Pas important », colonne « Urgent » puis « Pas urgent »
export const CATEGORIES: CategoryInfo[] = [
  category({
    key: "UI",
    urgent: true,
    important: true,
  }),
  category({
    key: "INU",
    urgent: false,
    important: true,
  }),
  category({
    key: "UDI",
    urgent: true,
    important: false,
  }),
  category({
    key: "NDNI",
    urgent: false,
    important: false,
  }),
];

export const CATEGORY_BY_KEY = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<Category, CategoryInfo>;

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.some((c) => c.key === value);
}

export function categoryFromFlags(urgent: boolean, important: boolean): Category {
  return CATEGORIES.find((c) => c.urgent === urgent && c.important === important)!
    .key;
}
