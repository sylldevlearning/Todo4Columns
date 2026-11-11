import { Category } from "../types";

// Liens profonds ouverts depuis les widgets (schéma de l'app, app.json › scheme). expo-router les
// mène aux écrans : app/task.tsx (id, category, voice) et app/quadrant/[category].tsx.
export const APP_SCHEME = "todo4columns";

const link = (path: string, params: Record<string, string> = {}) => {
  const query = new URLSearchParams(params).toString();
  return `${APP_SCHEME}://${path}${query ? `?${query}` : ""}`;
};

// Fiche d'une tâche
export const taskLink = (id: string) => link("task", { id });
// Nouvelle tâche (dans un quadrant si précisé), avec l'écoute du micro si voice
export const newTaskLink = (category?: Category, voice = false) =>
  link("task", { ...(category ? { category } : {}), ...(voice ? { voice: "1" } : {}) });
// Une case de la matrice
export const quadrantLink = (category: Category) => link(`quadrant/${category}`);
// Calendrier (en-tête de « Aujourd'hui »)
export const calendarLink = () => link("calendar");
// Matrice (en-tête de « Matrice »)
export const matrixLink = () => link("");

// Actions traitées par le gestionnaire des widgets (sans ouvrir l'app)
export const COMPLETE_ACTION = "COMPLETE";
