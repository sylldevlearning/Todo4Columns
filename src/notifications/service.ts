import * as Notifications from "expo-notifications";
import { Settings } from "../settings";
import { Task } from "../types";
import {
  computeSchedule,
  NotificationType,
  ScheduledNotification,
  WeeklyTrigger,
  weeklyReviewContent,
  weeklyReviewTrigger,
} from "./schedule";

export const CHANNEL_ID = "reminders";
export const CATEGORY_ID = "task-reminder";
// iOS ne garde que 64 notifications programmées
export const MAX_SCHEDULED = 64;

// Données jointes à chaque notification
export interface NotificationData {
  taskId: string;
  type: NotificationType;
  date: number;
}

// Données de la notification hebdomadaire de revue (elle ne concerne aucune tâche)
export const REVIEW_TYPE = "review";
export interface ReviewNotificationData extends WeeklyTrigger {
  type: typeof REVIEW_TYPE;
}

async function canSchedule(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Déclencheur de type date : pas besoin de la permission SCHEDULE_EXACT_ALARM
function scheduleItem(task: Task, item: ScheduledNotification): Promise<string> {
  const data: NotificationData = { taskId: task.id, type: item.type, date: item.date };
  return Notifications.scheduleNotificationAsync({
    content: {
      title: item.content.title,
      body: item.content.body,
      data: { ...data },
      categoryIdentifier: CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: item.date,
      channelId: CHANNEL_ID,
    },
  });
}

// Répétée chaque semaine par le système : une seule place prise dans la limite iOS
function scheduleReview(trigger: WeeklyTrigger): Promise<string> {
  const data: ReviewNotificationData = { type: REVIEW_TYPE, ...trigger };
  const { title, body } = weeklyReviewContent();
  return Notifications.scheduleNotificationAsync({
    content: { title, body, data: { ...data } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      ...trigger,
      channelId: CHANNEL_ID,
    },
  });
}

const isReview = (data: unknown): data is ReviewNotificationData =>
  (data as Partial<ReviewNotificationData> | null)?.type === REVIEW_TYPE;

export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

// Annule les notifications de la tâche, programme celles de computeSchedule et renvoie leurs identifiants.
// Sans autorisation, rien n'est programmé. Au-delà de la limite iOS, seules les plus proches le sont.
export async function syncTaskNotifications(
  task: Task,
  settings: Settings,
  now: number = Date.now()
): Promise<string[]> {
  await cancelNotifications(task.notificationIds);
  if (!(await canSchedule())) return [];

  const items = computeSchedule(task, settings, now);
  if (items.length === 0) return [];

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  // Place réservée à la revue de la semaine si elle n'est pas encore programmée
  const reserved =
    weeklyReviewTrigger(settings) !== null && !scheduled.some((n) => isReview(n.content.data))
      ? 1
      : 0;
  const budget = Math.max(0, MAX_SCHEDULED - scheduled.length - reserved);
  const ids: string[] = [];
  for (const item of items.slice(0, budget)) ids.push(await scheduleItem(task, item));
  return ids;
}

// Identifie une notification par son contenu : tâche, type, date et texte
const keyOf = (taskId: string, type: string, date: number, title: string, body: string) =>
  JSON.stringify([taskId, type, date, title, body]);

const reviewKeyOf = (trigger: WeeklyTrigger, title: string, body: string) =>
  JSON.stringify([REVIEW_TYPE, trigger.weekday, trigger.hour, trigger.minute, title, body]);

// Réconcilie toutes les notifications : annule les orphelines ou périmées, programme celles
// qui manquent (les 64 plus proches au maximum, dont la revue de la semaine si elle est
// activée). Renvoie les identifiants de chaque tâche.
export async function reconcileNotifications(
  tasks: Task[],
  settings: Settings,
  now: number = Date.now()
): Promise<Record<string, string[]>> {
  const granted = await canSchedule();
  const review = granted ? weeklyReviewTrigger(settings, now) : null;
  const desired = granted
    ? tasks
        .flatMap((task) => computeSchedule(task, settings, now).map((item) => ({ task, item })))
        .sort((a, b) => a.item.date - b.item.date)
        .slice(0, MAX_SCHEDULED - (review ? 1 : 0))
    : [];
  const { title: reviewTitle, body: reviewBody } = weeklyReviewContent();
  const reviewKey = review ? reviewKeyOf(review, reviewTitle, reviewBody) : null;
  const desiredKeys = new Set(
    desired.map(({ task, item }) =>
      keyOf(task.id, item.type, item.date, item.content.title, item.content.body)
    )
  );
  if (reviewKey) desiredKeys.add(reviewKey);

  // Garde ce qui est déjà programmé et toujours voulu, annule le reste
  const kept = new Map<string, string>();
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    const data = (n.content.data ?? {}) as Partial<NotificationData>;
    const key = isReview(n.content.data)
      ? reviewKeyOf(n.content.data, n.content.title ?? "", n.content.body ?? "")
      : data.taskId && data.type && typeof data.date === "number"
      ? keyOf(data.taskId, data.type, data.date, n.content.title ?? "", n.content.body ?? "")
      : null;
    if (key !== null && desiredKeys.has(key) && !kept.has(key)) kept.set(key, n.identifier);
    else await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
  }

  if (review && reviewKey && !kept.has(reviewKey)) await scheduleReview(review);

  const result: Record<string, string[]> = Object.fromEntries(tasks.map((t) => [t.id, []]));
  for (const { task, item } of desired) {
    const key = keyOf(task.id, item.type, item.date, item.content.title, item.content.body);
    result[task.id].push(kept.get(key) ?? (await scheduleItem(task, item)));
  }
  return result;
}

// Fonctions utilisées par useTasks (remplaçables dans les tests)
export interface Notifier {
  syncTask: typeof syncTaskNotifications;
  cancel: typeof cancelNotifications;
  reconcile: typeof reconcileNotifications;
}

export const defaultNotifier: Notifier = {
  syncTask: syncTaskNotifications,
  cancel: cancelNotifications,
  reconcile: reconcileNotifications,
};
