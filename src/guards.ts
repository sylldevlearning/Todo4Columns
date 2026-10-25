import { Category } from "./types";

// Clés de catégorie enregistrées dans les données (NE PAS MODIFIER)
export const CATEGORY_KEYS: readonly Category[] = ["UI", "INU", "UDI", "NDNI"];

// Objet simple, ni null ni tableau (lecture de données enregistrées ou importées)
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
