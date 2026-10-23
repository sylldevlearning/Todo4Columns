// Une importation par graisse : seules les 5 graisses utilisées sont embarquées dans l'app
// (l'index du paquet référence aussi ExtraLight et Light)
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationProvider, useCelebration } from "../src/celebration/CelebrationProvider";
import { configureNotifications } from "../src/notifications/setup";
import { useNotificationResponses } from "../src/notifications/useNotificationResponses";
import { TasksProvider, useTaskStore } from "../src/store/TasksContext";
import { colors } from "../src/theme";

// L'écran de démarrage reste affiché jusqu'au chargement de la police
SplashScreen.preventAutoHideAsync().catch(() => {});

// Canal « Rappels » et boutons d'action (aucune demande d'autorisation au lancement)
configureNotifications().catch((e) => console.warn("Erreur configuration notifications :", e));

// Applique les actions choisies dans les notifications
function NotificationResponses() {
  const { isLoaded, tasks, completeTask, snoozeTask } = useTaskStore();
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
  const { settings } = useTaskStore();
  return <CelebrationProvider enabled={settings.celebrations}>{children}</CelebrationProvider>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
