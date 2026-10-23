import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationProvider, useCelebration } from "../src/celebration/CelebrationProvider";
import { useAppFonts } from "../src/fonts";
import { configureNotifications } from "../src/notifications/setup";
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
  const { completeTask, snoozeTask } = useTaskActions();
  const { celebrate } = useCelebration();
  useNotificationResponses({
    isLoaded,
    tasks,
    completeTask,
    snoozeTask,
    openQuadrant: (category) => router.push(`/quadrant/${category}`),
    // « Fait » touché pendant que l'app est à l'écran
    onCompletedInApp: (task) => celebrate(task.category),
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

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <TasksProvider>
          <Celebrations>
            <NotificationResponses />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="quadrant/[category]" />
              <Stack.Screen name="settings" />
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
