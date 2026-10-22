import { router } from "expo-router";
import React from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import IconButton from "../src/components/IconButton";
import SettingsForm from "../src/components/SettingsForm";
import { openSystemSettings } from "../src/notifications/setup";
import { usePermissionState } from "../src/notifications/usePermissionState";
import { useTaskStore } from "../src/store/TasksContext";
import { colors, fonts } from "../src/theme";

// Écran des réglages : rappels par défaut, plage silencieuse, notifications, archives
export default function SettingsScreen() {
  const store = useTaskStore();
  const [permission, refreshPermission] = usePermissionState();
  const archived = store.tasks
    .filter((t) => t.archivedAt !== null)
    .sort((a, b) => b.archivedAt! - a.archivedAt!);

  const deleteForever = (id: string) => {
    const task = store.tasks.find((t) => t.id === id);
    Alert.alert(
      "Supprimer définitivement",
      `« ${task?.title ?? ""} » sera supprimée sans retour possible.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => store.removeTask(id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label="Retour" onPress={() => router.back()} />
        <Text style={styles.title} accessibilityRole="header">
          Réglages
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsForm
          settings={store.settings}
          onChange={store.updateSettings}
          permission={permission}
          onRequestPermission={() =>
            store.requestNotificationPermission().finally(refreshPermission)
          }
          onOpenSystemSettings={openSystemSettings}
          archivedTasks={archived}
          onRestore={store.unarchiveTask}
          onDeleteForever={deleteForever}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.text,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
});
