import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";
import { t } from "../i18n";
import {
  CATEGORY_ID,
  CHANNEL_ID,
  DELEGATE_CATEGORY_ID,
  NotificationData,
  REVIEW_TYPE,
  STEP_CATEGORY_ID,
} from "./service";

// Identifiants des boutons de notification
export const ACTION_DONE = "done";
export const ACTION_SNOOZE = "snooze";
export const ACTION_OPEN = "open";
export const ACTION_NUDGE = "nudge";
export const ACTION_POSTPONE = "postpone"; // « Reporter à demain » (étape)

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

  await updateNotificationTexts();
}

// Nom du canal Android et boutons d'action dans la langue courante (rappelé quand elle change)
export async function updateNotificationTexts(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t.notifications.channel,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Chaque bouton ouvre l'app : si elle a été arrêtée, un bouton qui ne l'ouvre pas ne lui
  // parvient jamais (comportement d'expo-notifications), et la tâche ne serait pas mise à jour
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACTION_DONE, buttonTitle: t.notifications.actionDone, options: { opensAppToForeground: true } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t.notifications.actionSnooze,
      options: { opensAppToForeground: true },
    },
    { identifier: ACTION_OPEN, buttonTitle: t.notifications.actionOpen, options: { opensAppToForeground: true } },
  ]);

  // Tâche confiée : « Relancer » ouvre l'app sur le partage avec un message prêt
  await Notifications.setNotificationCategoryAsync(DELEGATE_CATEGORY_ID, [
    { identifier: ACTION_DONE, buttonTitle: t.notifications.actionDone, options: { opensAppToForeground: true } },
    { identifier: ACTION_NUDGE, buttonTitle: t.notifications.actionNudge, options: { opensAppToForeground: true } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t.notifications.actionSnooze,
      options: { opensAppToForeground: true },
    },
  ]);

  // Étape du jour : « Fait » coche l'étape, « Reporter à demain » la décale d'un jour
  await Notifications.setNotificationCategoryAsync(STEP_CATEGORY_ID, [
    { identifier: ACTION_DONE, buttonTitle: t.notifications.actionDone, options: { opensAppToForeground: true } },
    {
      identifier: ACTION_POSTPONE,
      buttonTitle: t.notifications.actionPostpone,
      options: { opensAppToForeground: true },
    },
  ]);
}

const toState = (status: string): PermissionState =>
  status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";

export async function getPermissionState(): Promise<PermissionState> {
  return toState((await Notifications.getPermissionsAsync()).status);
}

// État et possibilité d'afficher la fenêtre système : Android ne la réaffiche plus après
// des refus répétés (canAskAgain faux), seuls les réglages du téléphone permettent alors
// d'autoriser les notifications
export async function getPermissionDetails(): Promise<{ state: PermissionState; canAskAgain: boolean }> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { state: toState(status), canAskAgain: canAskAgain !== false };
}

// Affiche la fenêtre système si elle peut l'être (jamais demandée, ou refusée une fois) ;
// asked faux : refusée et Android ne la montre plus, il faut passer par les réglages
export async function ensurePermission(): Promise<{ state: PermissionState; asked: boolean }> {
  const { state, canAskAgain } = await getPermissionDetails();
  if (state === "granted" || !canAskAgain) return { state, asked: false };
  const { status } = await Notifications.requestPermissionsAsync();
  return { state: toState(status), asked: true };
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
  completeStep?: (taskId: string, stepId: string) => void; // « Fait » d'une étape
  postponeStep?: (taskId: string, stepId: string) => void; // « Reporter à demain »
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
  // Rappel d'une étape : « Fait » et « Reporter à demain » concernent l'étape, un appui ouvre la tâche
  if (typeof data.stepId === "string") {
    if (response.actionIdentifier === ACTION_DONE && handlers.completeStep) {
      handlers.completeStep(data.taskId, data.stepId);
    } else if (response.actionIdentifier === ACTION_POSTPONE && handlers.postponeStep) {
      handlers.postponeStep(data.taskId, data.stepId);
    } else {
      handlers.open(data.taskId);
    }
    return true;
  }
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
