import { Category } from "../types";

export interface CategoryInfo {
  key: Category; // clé enregistrée dans AsyncStorage
  shortLabel: string; // libellé du bouton de sélection
  title: string; // titre de la colonne
  color: string; // couleur d'accent de la colonne
}

// Ordre d'affichage des boutons et des colonnes
export const CATEGORIES: CategoryInfo[] = [
  { key: "UI", shortLabel: "U-I", title: "Urgent + Important", color: "#CF6679" },
  { key: "INU", shortLabel: "NU-I", title: "Important + Non-urgent", color: "#BB86FC" },
  { key: "UDI", shortLabel: "U-NI", title: "Urgent + Non important", color: "#F2B84B" },
  { key: "NDNI", shortLabel: "NU-NI", title: "Ni Urgent ni Important", color: "#03DAC6" },
];
