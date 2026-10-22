// Clés de catégorie : NE PAS MODIFIER, elles sont enregistrées dans les données des utilisateurs
export type Category = "UI" | "INU" | "UDI" | "NDNI";

export interface Task {
  id: string;
  title: string;
  category: Category;
  isDone: boolean;
  timerEnd: number | null; // timestamp en ms où le timer se termine, ou null
  createdAt: number; // timestamp en ms
  updatedAt: number; // timestamp en ms de la dernière modification
  // Champs préparés pour les rappels, pas encore utilisés dans l'UI
  dueAt: number | null; // échéance (timestamp en ms)
  reminderOffset: number | null; // rappel, en minutes avant dueAt
  nagInterval: number | null; // délai entre deux relances, en minutes
  nagRepeat: boolean; // relances répétées
  notificationIds: string[]; // notifications programmées pour cette tâche
}
