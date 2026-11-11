import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useLanguage } from "../i18n";
import { TasksState, useSettings, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { nextMidnight } from "./data";
import { setLiveApp } from "./liveApp";
import { refreshWidgets } from "./render";

// Délai de regroupement : plusieurs changements de suite, un seul rafraîchissement
export const WIDGET_REFRESH_DELAY_MS = 500;

const selectTasks = ({ tasks }: TasksState) => tasks;
const selectReady = ({ isLoaded, loadError }: TasksState) => isLoaded && !loadError;

// Widgets de l'écran d'accueil (Android) tenus à jour depuis l'app : à chaque changement des
// tâches (y compris après une synchronisation), de la langue ou des réglages, et à minuit pour
// « Aujourd'hui ». Rend aussi les actions de l'app disponibles pour une coche depuis un widget.
export default function WidgetSync({ enabled = Platform.OS === "android" }: { enabled?: boolean }) {
  const actions = useTaskActions();
  const tasks = useTasksSelector(selectTasks);
  const ready = useTasksSelector(selectReady);
  const settings = useSettings();
  const language = useLanguage();

  useEffect(() => {
    if (!enabled) return;
    setLiveApp({
      isReady: () => {
        const { isLoaded, loadError } = actions.getTasksState();
        return isLoaded && !loadError;
      },
      completeTask: actions.completeTask,
      completeStep: actions.completeStep,
    });
    return () => setLiveApp(null);
  }, [actions, enabled]);

  // Rafraîchissement regroupé
  const latest = useRef({ tasks, settings });
  latest.current = { tasks, settings };
  useEffect(() => {
    if (!enabled || !ready) return;
    const timer = setTimeout(
      () => void refreshWidgets({ ...latest.current, now: Date.now() }),
      WIDGET_REFRESH_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [enabled, ready, tasks, settings, language]);

  // Minuit : « Aujourd'hui » passe au jour suivant (app ouverte ; sinon rafraîchissement périodique)
  useEffect(() => {
    if (!enabled || !ready) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => {
        void refreshWidgets({ ...latest.current, now: Date.now() }, ["DoFirstToday"]);
        arm();
      }, nextMidnight(Date.now()) - Date.now() + 1000);
    };
    arm();
    return () => clearTimeout(timer);
  }, [enabled, ready]);

  return null;
}
