import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { loadDriveState } from "../drive/driveBackup";
import { isDriveAvailable } from "../drive/googleAccount";
import { useBackup } from "../hooks/useBackup";
import { useDriveBackup } from "../hooks/useDriveBackup";
import { t } from "../i18n";
import { usePermissionState } from "../notifications/usePermissionState";
import { useSettingsReady, useSettingsSelector, useTaskActions, useTasksSelector } from "../store/TasksContext";

// Présentation passée avant l'écran Google Drive : carte proposée à partir de ce nombre de tâches
export const DEFERRED_DRIVE_MIN_TASKS = 10;
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";

// Carte discrète de la matrice pour qui a vu la présentation avant la 1.5 : propose une seule fois
// la sauvegarde Google Drive (facultative). Dès son apparition, elle est notée comme proposée.
// Jamais en même temps que la carte des rappels : si celle-ci s'affiche à ce lancement, la carte
// Drive attend le lancement suivant.
export default function DriveCard() {
  const ready = useSettingsReady();
  const eligible = useSettingsSelector((s) => s.onboardingDone && !s.drivePromptDone);
  const deferred = useSettingsSelector((s) => s.driveDeferred === true);
  // Assez de tâches (non archivées) pour une carte différée
  const enoughTasks = useTasksSelector(
    ({ tasks }) => tasks.filter((t) => t.archivedAt === null).length >= DEFERRED_DRIVE_MIN_TASKS
  );
  // Mêmes conditions que la carte des rappels (lues avant qu'elle les modifie)
  const remindersPending = useSettingsSelector((s) => s.onboardingDone && !s.remindersPromptDone);
  const [permission] = usePermissionState();
  const { updateSettings, getSettings } = useTaskActions();
  const backup = useBackup();
  const drive = useDriveBackup(backup.applyBackup);
  const [visible, setVisible] = useState(false);
  // Décision prise une seule fois par lancement, quand les réglages et l'autorisation sont connus
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current || !ready || permission === null) return;
    // Réglages pas encore à jour juste après leur lecture : pas de décision tant que la carte ne
    // semble pas concernée
    if (!eligible || !isDriveAvailable()) return;
    // Différée : décision quand l'utilisateur aura assez de tâches (peut-être plus tard dans la session)
    if (deferred && !enoughTasks) return;
    decided.current = true;
    // La carte des rappels passe d'abord
    if (remindersPending && permission === "undetermined") return;
    // État de la connexion lu avant de décider
    loadDriveState().then((state) => {
      updateSettings({ ...getSettings(), drivePromptDone: true, driveDeferred: undefined });
      // Déjà connecté (depuis les Réglages) : rien à proposer
      if (state.account === null) setVisible(true);
    }, () => {});
  }, [ready, permission, eligible, remindersPending, deferred, enoughTasks]);

  if (!visible || drive.account !== null) return null;
  const plan = CATEGORY_BY_KEY.INU;

  const connect = async () => {
    if (await drive.connect()) setVisible(false);
  };

  return (
    <View
      style={[styles.card, { backgroundColor: withAlpha(plan.color, 0.1), borderColor: withAlpha(plan.color, 0.3) }]}
      testID="drive-card"
    >
      <Ionicons name="cloud-upload-outline" size={18} color={plan.textColor} />
      <Text style={[styles.text, { color: plan.textColor }]}>{t.driveCard.body}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setVisible(false)}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.later}>{t.permissionCard.later}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={connect}
        disabled={drive.busy}
        style={({ pressed }) => [styles.action, styles.connect, { backgroundColor: withAlpha(plan.color, 0.18) }, pressed && styles.pressed]}
      >
        <Text style={[styles.connectText, { color: plan.textColor }]}>{t.driveCard.connect}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    minWidth: 140,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  action: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderRadius: 10,
  },
  connect: {
    paddingHorizontal: 12,
  },
  later: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  connectText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
});
