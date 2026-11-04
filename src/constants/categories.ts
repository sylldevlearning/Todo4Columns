import { t } from "../i18n";
import { Category } from "../types";

export interface CategoryInfo {
  key: Category; // clé enregistrée dans AsyncStorage : NE PAS MODIFIER
  name: string; // « Faire » / « Do »
  subtitle: string; // « Maintenant »
  axisLabel: string; // « Urgent et important »
  description: string; // phrase affichée dans la fiche de création
  urgent: boolean;
  important: boolean;
  color: string; // couleur du quadrant
  textColor: string; // texte coloré sur fond sombre
  onColor: string; // texte posé sur la couleur du quadrant
}

type CategoryStyle = Omit<CategoryInfo, "name" | "subtitle" | "axisLabel" | "description">;

// Quadrant dont les textes sont lus dans la langue courante à chaque accès
const category = (info: CategoryStyle): CategoryInfo =>
  Object.defineProperties({ ...info } as CategoryInfo, {
    name: { get: () => t.categories[info.key].name, enumerable: true },
    subtitle: { get: () => t.categories[info.key].subtitle, enumerable: true },
    axisLabel: { get: () => t.categories[info.key].axisLabel, enumerable: true },
    description: { get: () => t.categories[info.key].description, enumerable: true },
  });

// Ordre de la grille : ligne « Important » puis « Pas important », colonne « Urgent » puis « Pas urgent »
export const CATEGORIES: CategoryInfo[] = [
  category({
    key: "UI",
    urgent: true,
    important: true,
    color: "#FF7A59",
    textColor: "#FF9677",
    onColor: "#1A0F0B",
  }),
  category({
    key: "INU",
    urgent: false,
    important: true,
    color: "#5B9BFF",
    textColor: "#8BB8FF",
    onColor: "#0B1220",
  }),
  category({
    key: "UDI",
    urgent: true,
    important: false,
    color: "#F2B33D",
    textColor: "#F5C566",
    onColor: "#1C1405",
  }),
  category({
    key: "NDNI",
    urgent: false,
    important: false,
    color: "#8B92A0",
    textColor: "#B5BAC4",
    onColor: "#111318",
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
