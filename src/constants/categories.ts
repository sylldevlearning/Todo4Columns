import { Category } from "../types";

export interface CategoryInfo {
  key: Category; // clé enregistrée dans AsyncStorage : NE PAS MODIFIER
  name: string; // « Faire »
  subtitle: string; // « Maintenant »
  axisLabel: string; // « Urgent et important »
  description: string; // phrase affichée dans la fiche de création
  urgent: boolean;
  important: boolean;
  color: string; // couleur du quadrant
  textColor: string; // texte coloré sur fond sombre
  onColor: string; // texte posé sur la couleur du quadrant
}

// Ordre de la grille : ligne « Important » puis « Pas important », colonne « Urgent » puis « Pas urgent »
export const CATEGORIES: CategoryInfo[] = [
  {
    key: "UI",
    name: "Faire",
    subtitle: "Maintenant",
    axisLabel: "Urgent et important",
    description: "Urgent et important : à faire toi-même, maintenant.",
    urgent: true,
    important: true,
    color: "#FF7A59",
    textColor: "#FF9677",
    onColor: "#1A0F0B",
  },
  {
    key: "INU",
    name: "Planifier",
    subtitle: "Bloquer un créneau",
    axisLabel: "Important, pas urgent",
    description: "Important mais pas urgent : bloque un créneau pour t'y mettre.",
    urgent: false,
    important: true,
    color: "#5B9BFF",
    textColor: "#8BB8FF",
    onColor: "#0B1220",
  },
  {
    key: "UDI",
    name: "Déléguer",
    subtitle: "Confier et relancer",
    axisLabel: "Urgent, pas important",
    description: "Urgent mais pas important : confie-la et relance la personne.",
    urgent: true,
    important: false,
    color: "#F2B33D",
    textColor: "#F5C566",
    onColor: "#1C1405",
  },
  {
    key: "NDNI",
    name: "Éliminer",
    subtitle: "Laisser tomber",
    axisLabel: "Ni urgent ni important",
    description: "Ni urgent ni important : laisse tomber.",
    urgent: false,
    important: false,
    color: "#8B92A0",
    textColor: "#B5BAC4",
    onColor: "#111318",
  },
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
