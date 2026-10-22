// Clés de catégorie : NE PAS MODIFIER, elles sont enregistrées dans les données des utilisateurs
export type Category = "UI" | "INU" | "UDI" | "NDNI";

// Réglages de rappel d'une tâche (enregistrés, notifications programmées à l'étape 3)
export interface ReminderFields {
  dueAt: number | null; // échéance (timestamp en ms) — Planifier
  reminderOffset: number | null; // rappel, en minutes avant dueAt — Planifier
  nagInterval: number | null; // relance après N minutes — Faire, Déléguer
  nagRepeat: boolean; // répéter la relance — Faire
  delegatedTo: string | null; // personne à qui la tâche est confiée — Déléguer
}

export interface Task extends ReminderFields {
  id: string;
  title: string;
  category: Category;
  isDone: boolean;
  timerEnd: number | null; // timestamp en ms où le timer se termine, ou null
  createdAt: number; // timestamp en ms
  updatedAt: number; // timestamp en ms de la dernière modification
  notificationIds: string[]; // notifications programmées pour cette tâche
}
