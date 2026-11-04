// Identifiant unique de tâche, même pour deux tâches créées dans la même milliseconde
export const newId = (now: number) =>
  `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
