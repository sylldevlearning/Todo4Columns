// Clés de catégorie : NE PAS MODIFIER, elles sont enregistrées dans les données des utilisateurs
export type Category = "UI" | "INU" | "UDI" | "NDNI";

export type RecurrenceFreq = "daily" | "weekdays" | "weekly" | "monthly" | "yearly";

// Règle de répétition d'une tâche à échéance
export interface Recurrence {
  freq: RecurrenceFreq;
  days?: number[]; // weekly : jours de la semaine (0 = dimanche)
  monthDay?: number; // monthly, yearly : jour du mois voulu (1-31, ramené au dernier jour si besoin)
  month?: number; // yearly : mois (0 = janvier)
  // Heure voulue : gardée telle quelle, même si une occurrence a été décalée par le changement
  // d'heure (2 h 30 n'existe pas le jour du passage à l'heure d'été)
  hour?: number;
  minute?: number;
}

// Réglages de rappel d'une tâche (enregistrés, notifications programmées à l'étape 3)
export interface ReminderFields {
  dueAt: number | null; // échéance (timestamp en ms) — Planifier
  reminderOffset: number | null; // rappel, en minutes avant dueAt — Planifier
  nagInterval: number | null; // relance après N minutes — Faire, Déléguer
  nagRepeat: boolean; // répéter la relance — Faire
  delegatedTo: string | null; // personne à qui la tâche est confiée — Déléguer
  recurrence: Recurrence | null; // répétition — Planifier (gardée en Faire), avec une échéance
}

export interface Task extends ReminderFields {
  id: string;
  title: string;
  category: Category;
  isDone: boolean;
  timerEnd: number | null; // timestamp en ms où le timer se termine, ou null
  createdAt: number; // timestamp en ms
  updatedAt: number; // timestamp en ms de la dernière modification
  categoryChangedAt: number; // arrivée dans le quadrant actuel (timestamp en ms)
  archivedAt: number | null; // archivage automatique des tâches « Si j'ai le temps » (NDNI)
  snoozedUntil: number | null; // « Reporter 1 h » : prochaine relance repoussée à cette date
  notificationIds: string[]; // notifications programmées pour cette tâche
  // Absents des tâches importées par la récupération : équivalent à null
  completedAt?: number | null; // date où la tâche a été terminée (timestamp en ms)
  priorityWeek?: number | null; // priorité de la semaine qui commence à cette date (lundi 0 h)
  nextOccurrenceId?: string | null; // tâche récurrente terminée : occurrence créée à sa place
  escalationSkippedFor?: number | null; // bascule en Faire annulée pour cette échéance
}
