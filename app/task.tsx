import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCelebration } from "../src/celebration/CelebrationProvider";
import TaskForm, { TaskFormValues } from "../src/components/TaskForm";
import { isCategory } from "../src/constants/categories";
import { openSystemSettings } from "../src/notifications/setup";
import { usePermissionState } from "../src/notifications/usePermissionState";
import { hasReminder } from "../src/reminders";
import { useSettings, useTaskActions, useTasksSelector } from "../src/store/TasksContext";
import { colors } from "../src/theme";

// Fiche (formSheet) de création ou de modification d'une tâche
// Paramètres : id (modification) ou category (création depuis un quadrant)
export default function TaskSheet() {
  const { id, category } = useLocalSearchParams<{ id?: string; category?: string }>();
  const { addTask, updateTask, completeTask, requestNotificationPermission, updateSettings, getSettings } =
    useTaskActions();
  const { celebrate } = useCelebration();
  const settings = useSettings();
  // Seulement la tâche modifiée : les autres changements ne re-rendent pas la fiche
  const task = useTasksSelector(({ tasks }) => (id ? tasks.find((t) => t.id === id) : undefined));
  const [permission] = usePermissionState();
  const insets = useSafeAreaInsets();
  const missing = id !== undefined && task === undefined;

  // Tâche supprimée entre-temps : on ferme la fiche
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);
  if (missing) return null;

  const submit = (values: TaskFormValues) => {
    if (task) updateTask(task.id, values);
    else addTask(values);
    // Premier rappel : c'est le moment de demander l'autorisation
    if (hasReminder(values.category, values)) {
      requestNotificationPermission().catch(() => {});
    }
    router.back();
  };

  // Dernière étape cochée puis « Terminer » : la tâche est enregistrée et terminée, la fiche se
  // ferme et la célébration complète se joue sur l'écran d'en dessous
  const complete = (values: TaskFormValues) => {
    if (!task) return;
    updateTask(task.id, values);
    completeTask(task.id);
    router.back();
    celebrate(values.category);
  };

  return (
    // Glissement des étapes : la fiche a sa propre racine de gestes (feuille native)
    <GestureHandlerRootView style={styles.root}>
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <TaskForm
          task={task}
          initialCategory={isCategory(category) ? category : undefined}
          settings={settings}
          notificationsDenied={permission === "denied"}
          onOpenSettings={openSystemSettings}
          onEditQuietHours={() =>
            router.push({ pathname: "/settings", params: { section: "quietHours" } })
          }
          onDisableQuietHours={() => updateSettings({ ...getSettings(), quietHoursEnabled: false })}
          onSubmit={submit}
          onComplete={complete}
        />
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
  },
  content: {
    padding: 20,
    paddingTop: 28,
  },
});
