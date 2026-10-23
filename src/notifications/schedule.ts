import { formatDue } from "../format";
import { t } from "../i18n";
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
  return spaceOutOfQuietHours(rawNagNotifications(task, settings), task.nagInterval! * MINUTE, settings);
}

// Plage silencieuse : une seule relance à sa fin, les suivantes réespacées d'un intervalle à
// partir de là (sinon toutes les relances de la nuit arriveraient ensemble à la fin de la plage)
function spaceOutOfQuietHours(
  items: ScheduledNotification[],
  interval: number,
  settings: Settings
): ScheduledNotification[] {
  let last = -Infinity;
  return items.map((item) => {
    let date = shiftOutOfQuietHours(item.date, settings.quietHoursStart, settings.quietHoursEnd);
    if (date <= last) {
      date = shiftOutOfQuietHours(last + interval, settings.quietHoursStart, settings.quietHoursEnd);
    }
    last = date;
    return { ...item, date };
  });
}

function rawNagNotifications(task: Task, settings: Settings): ScheduledNotification[] {
  if (task.nagInterval === null) return [];
  const interval = task.nagInterval * MINUTE;
  const total = task.nagRepeat ? settings.maxNags : 1;
  const nag = (date: number, index: number): ScheduledNotification => ({
    date,
    type: "nag",
    content: {
      title: task.title,
      body: total > 1 ? t.notifications.nagCount(index, total) : t.notifications.nag,
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
      content: { title: task.title, body: t.notifications.nagSnoozed },
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

// Revue de la semaine : notification hebdomadaire au format attendu par expo-notifications
export interface WeeklyTrigger {
  weekday: number; // 1 = dimanche … 7 = samedi
  hour: number;
  minute: number;
}

// Jour et heure de la notification de revue, ou null si elle est désactivée.
// Une heure dans la plage silencieuse est décalée à sa fin (éventuellement le lendemain).
export function weeklyReviewTrigger(
  settings: Settings,
  reference: number = Date.now()
): WeeklyTrigger | null {
  if (!settings.weeklyReview) return null;
  const date = new Date(reference);
  date.setDate(date.getDate() + settings.weeklyReviewDay - date.getDay());
  const [h, m] = settings.weeklyReviewTime.split(":").map(Number);
  date.setHours(h, m, 0, 0);
  const shifted = new Date(
    shiftOutOfQuietHours(date.getTime(), settings.quietHoursStart, settings.quietHoursEnd)
  );
  return { weekday: shifted.getDay() + 1, hour: shifted.getHours(), minute: shifted.getMinutes() };
}

export const weeklyReviewContent = () => ({
  title: t.review.title,
  body: t.notifications.weeklyReview,
});

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
            content: { title: task.title, body: t.notifications.dueSoon(formatDue(task.dueAt)) },
          });
        }
        items.push({
          date: task.dueAt,
          type: "due",
          // Bascule automatique activée : la tâche passe en Faire d'elle-même, on l'annonce
          content: {
            title: task.title,
            body: settings.autoEscalate ? t.notifications.dueEscalated : t.notifications.dueReached,
          },
        });
      }
      items.push(...snoozeNotification(task, t.notifications.planSnoozed));
      break;
    case "UDI":
      if (task.nagInterval !== null) {
        items.push({
          date: task.updatedAt + task.nagInterval * MINUTE,
          type: "delegate",
          content: {
            title: task.title,
            body: t.notifications.delegate(task.delegatedTo),
          },
        });
      }
      items.push(...snoozeNotification(task, t.notifications.delegateSnoozed(task.delegatedTo)));
      break;
  }

  if (task.timerEnd !== null) {
    items.push({
      date: task.timerEnd,
      type: "timer",
      content: { title: task.title, body: t.notifications.timerDone },
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
