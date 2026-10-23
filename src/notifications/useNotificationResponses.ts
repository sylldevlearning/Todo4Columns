import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Category, Task } from "../types";
import { handleNotificationResponse, responseKey } from "./setup";

// Dernière réponse appliquée, pour ne pas la rejouer à chaque démarrage
export const HANDLED_RESPONSE_KEY = "LAST_HANDLED_NOTIFICATION_RESPONSE";

interface Options {
  isLoaded: boolean;
  tasks: Task[];
  completeTask: (id: string) => void;
  snoozeTask: (id: string) => void;
  openQuadrant: (category: Category) => void;
  openReview?: () => void; // notification de la revue de la semaine
  // « Fait » reçu pendant que l'app est au premier plan (pour la célébration)
  onCompletedInApp?: (task: Task) => void;
}

// Applique « Fait », « Reporter 1 h », « Ouvrir » et le tap sur une notification,
// y compris quand l'app était fermée (dernière réponse lue au démarrage)
export function useNotificationResponses(options: Options): void {
  const latest = useRef(options);
  latest.current = options;
  const pending = useRef<Notifications.NotificationResponse[]>([]);
  const handled = useRef(new Set<string>());

  // live : réponse reçue pendant que l'app tourne et que les tâches sont chargées
  const applyOnce = (response: Notifications.NotificationResponse, live = false) => {
    const key = responseKey(response);
    if (handled.current.has(key)) return;
    handled.current.add(key);
    AsyncStorage.setItem(HANDLED_RESPONSE_KEY, key).catch(() => {});
    handleNotificationResponse(response, {
      complete: (id) => {
        const task = latest.current.tasks.find((t) => t.id === id);
        latest.current.completeTask(id);
        // Jamais au démarrage (app fermée) ni en arrière-plan : personne ne verrait la célébration
        if (live && task && !task.isDone && AppState.currentState === "active") {
          latest.current.onCompletedInApp?.(task);
        }
      },
      snooze: (id) => latest.current.snoozeTask(id),
      openReview: () => latest.current.openReview?.(),
      open: (id) => {
        const task = latest.current.tasks.find((t) => t.id === id);
        if (task) latest.current.openQuadrant(task.category);
      },
    });
  };

  // Réponses reçues pendant que l'app tourne (mises en attente avant le chargement des tâches)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (latest.current.isLoaded) applyOnce(response, true);
      else pending.current.push(response);
    });
    return () => subscription.remove();
  }, []);

  // Une fois les tâches chargées : réponse donnée pendant que l'app était fermée, puis l'attente
  useEffect(() => {
    if (!options.isLoaded) return;
    (async () => {
      const last = Notifications.getLastNotificationResponse();
      if (last) {
        const alreadyHandled = (await AsyncStorage.getItem(HANDLED_RESPONSE_KEY)) === responseKey(last);
        if (alreadyHandled) handled.current.add(responseKey(last));
        else applyOnce(last);
        Notifications.clearLastNotificationResponse();
      }
      pending.current.splice(0).forEach((response) => applyOnce(response));
    })().catch((e) => console.warn("Erreur réponse notification :", e));
  }, [options.isLoaded]);
}
