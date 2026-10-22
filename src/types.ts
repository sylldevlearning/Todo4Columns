// Clés de catégorie : NE PAS MODIFIER, elles sont enregistrées dans les données des utilisateurs
export type Category = "UI" | "INU" | "UDI" | "NDNI";

export interface Task {
  id: string;
  title: string;
  category: Category;
  isDone: boolean;
  timerEnd: number | null; // timestamp en ms où le timer se termine, ou null
}
