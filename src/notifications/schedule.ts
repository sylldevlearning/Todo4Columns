import { formatDue } from "../format";
import { Settings } from "../settings";
import { Task } from "../types";

const MINUTE = 60 * 1000;

// « Reporter 1 h »
export const SNOOZE_MINUTES = 60;

export type NotificationType =
  | "nag" // Faire : relance si pas faite
  | "reminder" // Planifier : rappel avant l'échéance
  | "due" // Planifier : échéance atteinte
  | "delegate" // Déléguer : relance de la personne
  | "timer" // minuteur terminé
  | "snooze"; // rappel reporté avec « Reporter 1 h »

export interface ScheduledNotification {
  date: number; // timestamp en ms, hors plage silencieuse
  type: NotificationType;
  content: { title: string; body: string };
  nagIndex?: number; // relance n° nagIndex sur nagTotal (Faire)
  nagTotal?: number;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Décale une date qui tombe dans la plage silencieuse à la fin de celle-ci (heure locale)
export function shiftOutOfQuietHours(ts: number, start: string, end: string): number {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === endMin) return ts; // pas de plage silencieuse

  const d = new Date(ts);
  const minute = d.getHours() * 60 + d.getMinutes();
  const overnight = startMin > endMin; // ex. 22:00 → 08:00
  const inQuiet = overnight
    ? minute >= startMin || minute < endMin
    : minute >= startMin && minute < endMin;
  if (!inQuiet) return ts;

  const shifted = new Date(ts);
  // Avant minuit dans une plage qui passe la nuit : la fin est le lendemain
  if (overnight && minute >= startMin) shifted.setDate(shifted.getDate() + 1);
  shifted.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
  return shifted.getTime();
}

// Relances « Faire » : updatedAt + k × intervalle, jusqu'au maximum si la répétition est active.
// Un report (snoozedUntil) déplace la prochaine relance sans compter dans le maximum.
function nagNotifications(task: Task, settings: Settings): ScheduledNotification[] {
  if (task.nagInterval === null) return [];
  const interval = task.nagInterval * MINUTE;
  const total = task.nagRepeat ? settings.maxNags : 1;
  const nag = (date: number, index: number): ScheduledNotification => ({
    date,
    type: "nag",
    content: {
      title: task.title,
      body: total > 1 ? `Toujours pas faite ? Relance ${index}/${total}` : "Toujours pas faite ?",
    },
    nagIndex: index,
    nagTotal: total,
  });

  const planned = Array.from({ length: total }, (_, i) => task.updatedAt + (i + 1) * interval);
  if (task.snoozedUntil === null) return planned.map((date, i) => nag(date, i + 1));

  // Relances déjà passées au moment du report : elles restent comptées
  const snoozedAt = task.snoozedUntil - SNOOZE_MINUTES * MINUTE;
  const sent = planned.filter((date) => date <= snoozedAt).length;
  const result: ScheduledNotification[] = [
    {
      date: task.snoozedUntil,
      type: "snooze",
      content: { title: task.title, body: "Rappel reporté : toujours pas faite ?" },
    },
  ];
  for (let index = sent + 1; index <= total; index++) {
    result.push(nag(task.snoozedUntil + (index - sent) * interval, index));
  }
  return result;
}

function snoozeNotification(task: Task, body: string): ScheduledNotification[] {
  return task.snoozedUntil === null
    ? []
    : [{ date: task.snoozedUntil, type: "snooze", content: { title: task.title, body } }];
}

// Notifications à programmer pour une tâche, triées par date.
// Les dates en plage silencieuse sont décalées à sa fin (sauf les minuteurs),
// les dates passées sont ignorées.
export function computeSchedule(
  task: Task,
  settings: Settings,
  now: number
): ScheduledNotification[] {
  if (task.isDone || task.archivedAt !== null || task.category === "NDNI") return [];

  const items: ScheduledNotification[] = [];
  switch (task.category) {
    case "UI":
      items.push(...nagNotifications(task, settings));
      break;
    case "INU":
      if (task.dueAt !== null) {
        if (task.reminderOffset !== null && task.reminderOffset > 0) {
          items.push({
            date: task.dueAt - task.reminderOffset * MINUTE,
            type: "reminder",
            content: { title: task.title, body: `Échéance : ${formatDue(task.dueAt)}` },
          });
        }
        items.push({
          date: task.dueAt,
          type: "due",
          content: { title: task.title, body: "Échéance atteinte, passer en Faire ?" },
        });
      }
      items.push(...snoozeNotification(task, "Rappel reporté : c'est le moment ?"));
      break;
    case "UDI":
      if (task.nagInterval !== null) {
        items.push({
          date: task.updatedAt + task.nagInterval * MINUTE,
          type: "delegate",
          content: {
            title: task.title,
            body: task.delegatedTo
              ? `As-tu des nouvelles de ${task.delegatedTo} ?`
              : "As-tu des nouvelles ?",
          },
        });
      }
      items.push(
        ...snoozeNotification(
          task,
          task.delegatedTo
            ? `Rappel reporté : des nouvelles de ${task.delegatedTo} ?`
            : "Rappel reporté : des nouvelles ?"
        )
      );
      break;
  }

  if (task.timerEnd !== null) {
    items.push({
      date: task.timerEnd,
      type: "timer",
      content: { title: task.title, body: "Minuteur terminé" },
    });
  }

  return items
    .map((item) => ({
      ...item,
      // Un minuteur sonne toujours à l'heure prévue
      date:
        item.type === "timer"
          ? item.date
          : shiftOutOfQuietHours(item.date, settings.quietHoursStart, settings.quietHoursEnd),
    }))
    .filter((item) => item.date > now)
    .sort((a, b) => a.date - b.date);
}
