import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import { t } from "../i18n";
import {
  CATEGORY_ID,
  CHANNEL_ID,
  DELEGATE_CATEGORY_ID,
  NotificationData,
  REVIEW_TYPE,
} from "./service";

// Identifiants des boutons de notification
export const ACTION_DONE = "done";
export const ACTION_SNOOZE = "snooze";
export const ACTION_OPEN = "open";
export const ACTION_NUDGE = "nudge";

export type PermissionState = "granted" | "denied" | "undetermined";

// Canal Android, boutons d'action et affichage au premier plan. Ne demande aucune autorisation.
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Au premier plan, la fin du minuteur est déjà signalée par une alerte dans l'app
      const data = notification.request.content.data as Partial<NotificationData>;
      const show = data?.type !== "timer";
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t.notifications.channel,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_DONE, buttonTitle: t.notifications.actionDone, options: { opensAppToForeground: false } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t.notifications.actionSnooze,
      options: { opensAppToForeground: false },
    },
    { identifier: ACTION_OPEN, buttonTitle: t.notifications.actionOpen, options: { opensAppToForeground: true } },
  ]);

  // Tâche confiée : « Relancer » ouvre l'app sur le partage avec un message prêt
  await Notifications.setNotificationCategoryAsync(DELEGATE_CATEGORY_ID, [
    { identifier: ACTION_DONE, buttonTitle: t.notifications.actionDone, options: { opensAppToForeground: false } },
    { identifier: ACTION_NUDGE, buttonTitle: t.notifications.actionNudge, options: { opensAppToForeground: true } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t.notifications.actionSnooze,
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

// Demande l'autorisation si elle n'a jamais été demandée ; renvoie l'état obtenu
export async function ensurePermission(): Promise<PermissionState> {
  const current = await getPermissionState();
  if (current !== "undetermined") return current;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
}

export function openSystemSettings(): void {
  Linking.openSettings().catch(() => {});
}

export interface ResponseHandlers {
  complete: (taskId: string) => void; // « Fait »
  snooze: (taskId: string) => void; // « Reporter 1 h »
  open: (taskId: string) => void; // « Ouvrir » ou tap sur la notification
  openReview?: () => void; // tap sur la notification de revue de la semaine
  nudge?: (taskId: string) => void; // « Relancer » d'une tâche confiée
}

// Applique l'action choisie dans une notification ; renvoie false si elle ne concerne aucune tâche
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  handlers: ResponseHandlers
): boolean {
  const data = response.notification.request.content.data as Partial<NotificationData>;
  if ((data as { type?: string } | null)?.type === REVIEW_TYPE) {
    handlers.openReview?.();
    return true;
  }
  if (!data?.taskId) return false;
  switch (response.actionIdentifier) {
    case ACTION_DONE:
      handlers.complete(data.taskId);
      break;
    case ACTION_SNOOZE:
      handlers.snooze(data.taskId);
      break;
    case ACTION_NUDGE:
      if (handlers.nudge) handlers.nudge(data.taskId);
      else handlers.open(data.taskId);
      break;
    default:
      handlers.open(data.taskId);
  }
  return true;
}

// Identifie une réponse, pour ne pas appliquer deux fois la même au redémarrage
export const responseKey = (response: Notifications.NotificationResponse) =>
  `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
