import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const { addTask, updateTask, requestNotificationPermission } = useTaskActions();
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

  return (
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
        onSubmit={submit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
  },
  content: {
    padding: 20,
    paddingTop: 28,
  },
});
