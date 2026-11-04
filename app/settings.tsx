import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import IconButton from "../src/components/IconButton";
import Onboarding from "../src/components/Onboarding";
import SettingsForm from "../src/components/SettingsForm";
import { appVersion, openStoreListing, sendFeedback, shareApp } from "../src/community";
import { t, useLanguage } from "../src/i18n";
import { useBackup } from "../src/hooks/useBackup";
import { openSystemSettings } from "../src/notifications/setup";
import { usePermissionState } from "../src/notifications/usePermissionState";
import { sameItems } from "../src/store/selectableStore";
import {
  TasksState,
  useSettings,
  useTaskActions,
  useTasksSelector,
} from "../src/store/TasksContext";
import { colors, fonts } from "../src/theme";
import { showAlert } from "../src/appWindows";

const ABOUT = {
  version: appVersion(),
  onRate: openStoreListing,
  onShare: shareApp,
  onFeedback: sendFeedback,
};

// Seules les archives sont affichées : cocher une tâche ne re-rend pas cet écran
const selectArchived = ({ tasks }: TasksState) =>
  tasks.filter((t) => t.archivedAt !== null).sort((a, b) => b.archivedAt! - a.archivedAt!);

// Écran des réglages : rappels par défaut, plage silencieuse, notifications, archives
export default function SettingsScreen() {
  useLanguage(); // textes mis à jour quand la langue change
  const store = useTaskActions();
  const settings = useSettings();
  const [permission, refreshPermission, canAskPermission] = usePermissionState();
  const archived = useTasksSelector(selectArchived, sameItems);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Ouvert depuis la fiche (« Modifier la plage ») : défile jusqu'à la plage silencieuse
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scroll = useRef<ScrollView>(null);
  const scrollToQuietHours = (y: number) => {
    if (section === "quietHours") scroll.current?.scrollTo({ y, animated: false });
  };
  const backup = useBackup();

  const deleteForever = (id: string) => {
    const task = archived.find((t) => t.id === id);
    showAlert(
      t.settings.deleteForever,
      t.settings.deleteForeverBody(task?.title ?? ""),
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.common.delete, style: "destructive", onPress: () => store.removeTask(id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label={t.common.back} onPress={() => router.back()} />
        <Text style={styles.title} accessibilityRole="header">
          {t.settings.title}
        </Text>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        <SettingsForm
          settings={settings}
          onChange={store.updateSettings}
          permission={permission}
          canAskPermission={canAskPermission}
          onRequestPermission={() =>
            store.requestNotificationPermission().finally(refreshPermission)
          }
          onOpenSystemSettings={openSystemSettings}
          archivedTasks={archived}
          onRestore={store.unarchiveTask}
          onDeleteForever={deleteForever}
          onShowOnboarding={() => setShowOnboarding(true)}
          onOpenHowTo={() => router.push("/help")}
          onOpenReview={() => router.push("/review")}
          onExport={backup.exportData}
          onImport={backup.importData}
          onUndoImport={backup.canUndoImport ? backup.undoImport : undefined}
          onQuietHoursLayout={scrollToQuietHours}
          about={ABOUT}
        />
      </ScrollView>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
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
