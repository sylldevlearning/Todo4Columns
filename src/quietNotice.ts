import { computeSchedule, shiftOutOfQuietHours } from "./notifications/schedule";
import { Settings } from "./settings";
import { Category, ReminderFields, Task } from "./types";

export interface QuietNotice {
  start: string; // début de la plage, "HH:MM"
  end: string; // fin de la plage
  arrival: string; // heure d'arrivée du rappel, "HH:MM"
}

const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

// Rappel de la fiche (tel qu'il serait enregistré maintenant) qui tombe dans la plage
// silencieuse : il arrivera à sa fin. null si la plage est désactivée ou si aucun ne tombe dedans.
export function quietNoticeFor(
  draft: { category: Category } & ReminderFields,
  settings: Settings,
  now: number
): QuietNotice | null {
  if (!settings.quietHoursEnabled) return null;
  const task: Task = {
    id: "fiche",
    title: "",
    isDone: false,
    timerEnd: null,
    createdAt: now,
    // Enregistrer la fiche fait partir les relances de maintenant
    updatedAt: now,
    categoryChangedAt: now,
    archivedAt: null,
    snoozedUntil: null,
    notificationIds: [],
    ...draft,
  };
  // Horaires prévus sans la plage, puis le premier qui tombe dedans
  const planned = computeSchedule(task, { ...settings, quietHoursEnabled: false }, now);
  for (const item of planned) {
    const arrival = shiftOutOfQuietHours(item.date, settings.quietHoursStart, settings.quietHoursEnd);
    if (arrival !== item.date) {
      return { start: settings.quietHoursStart, end: settings.quietHoursEnd, arrival: hhmm(arrival) };
    }
  }
  return null;
}
