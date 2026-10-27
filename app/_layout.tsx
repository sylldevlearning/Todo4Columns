import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationProvider, useCelebration } from "../src/celebration/CelebrationProvider";
import EscalationNotice from "../src/components/EscalationNotice";
import LoadErrorGate from "../src/components/LoadErrorGate";
import PermissionCard from "../src/components/PermissionCard";
import ReviewPrompter from "../src/components/ReviewPrompter";
import { removeExportedFiles } from "../src/backup";
import { FirstLaunchOnboarding } from "../src/components/Onboarding";
import { nudgeMessage, shareWhenActive } from "../src/delegation";
import { useAppFonts } from "../src/fonts";
import { offerToFinishAfterStep } from "../src/finishPrompt";
import { configureNotifications } from "../src/notifications/setup";
import { stepsOf } from "../src/steps";
import { useNotificationResponses } from "../src/notifications/useNotificationResponses";
import {
  TasksProvider,
  TasksState,
  useSettingsSelector,
  useTaskActions,
  useTasksSelector,
} from "../src/store/TasksContext";
import { colors } from "../src/theme";

// L'écran de démarrage reste affiché jusqu'au premier affichage (Android) ou au chargement
// des polices (iOS, web)
SplashScreen.preventAutoHideAsync().catch(() => {});

// Canal « Rappels » et boutons d'action (aucune demande d'autorisation au lancement)
configureNotifications().catch((e) => console.warn("Erreur configuration notifications :", e));

const allTasks = (state: TasksState) => state;

// Applique les actions choisies dans les notifications
function NotificationResponses() {
  const { isLoaded, tasks } = useTasksSelector(allTasks);
  const { completeTask, snoozeTask, completeStep, postponeStep, getTasksState } = useTaskActions();
  const { celebrate, celebrateStep } = useCelebration();
  useNotificationResponses({
    isLoaded,
    tasks,
    completeTask,
    snoozeTask,
    openQuadrant: (category) => router.push(`/quadrant/${category}`),
    openReview: () => router.push("/review"),
    // « Relancer » : l'app s'ouvre sur la tâche, puis le partage avec un message prêt
    nudge: (task) => {
      router.push(`/quadrant/${task.category}`);
      shareWhenActive(nudgeMessage(task));
    },
    // « Fait » touché pendant que l'app est à l'écran
    onCompletedInApp: (task) => celebrate(task.category),
    completeStep,
    postponeStep,
    // « Fait » d'une étape, app à l'écran : petite célébration ; la dernière propose de finir
    onStepCompletedInApp: (task, stepId) => {
      celebrateStep(task.category);
      if (task.isDone) return;
      offerToFinishAfterStep(stepsOf(task), stepId, () => {
        if (getTasksState().tasks.some((t) => t.id === task.id && !t.isDone)) {
          completeTask(task.id);
          celebrate(task.category);
        }
      });
    },
  });
  return null;
}

// Célébrations selon le réglage « Animations de célébration »
function Celebrations({ children }: { children: React.ReactNode }) {
  const enabled = useSettingsSelector((s) => s.celebrations);
  return <CelebrationProvider enabled={enabled}>{children}</CelebrationProvider>;
}

export default function RootLayout() {
  const fontsReady = useAppFonts();

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  // Fichiers de sauvegarde exportés lors d'une session précédente : retirés du cache
  useEffect(removeExportedFiles, []);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <TasksProvider>
          <Celebrations>
            <NotificationResponses />
            <FirstLaunchOnboarding />
            <LoadErrorGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="quadrant/[category]" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="help" />
              <Stack.Screen name="balance" />
              <Stack.Screen name="review" />
              <Stack.Screen
                name="task"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: [0.9],
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 24,
                  contentStyle: { backgroundColor: colors.surface },
                }}
              />
            </Stack>
            </LoadErrorGate>
            <EscalationNotice />
            <PermissionCard />
            <ReviewPrompter />
          </Celebrations>
        </TasksProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
