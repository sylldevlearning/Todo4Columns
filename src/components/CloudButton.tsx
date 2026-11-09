import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { showAlert } from "../appWindows";
import { isDriveAvailable } from "../drive/googleAccount";
import { formatDue } from "../format";
import { syncStatusLine, useDriveSync } from "../hooks/useDriveSync";
import { t } from "../i18n";
import { SyncStatus } from "../sync/controller";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { IconName } from "./IconButton";

// Heure courte « 14:32 » (ou « 2:32 PM »)
const shortTime = (ts: number) => new Date(ts).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });

function look(account: string | null, status: SyncStatus): { icon: IconName; color: string; label: string; caption: string | null } {
  if (account === null) return { icon: "cloud-outline", color: colors.textMuted, label: t.drive.cloud.off, caption: null };
  switch (status.phase) {
    case "syncing":
      return { icon: "sync-outline", color: colors.text, label: t.drive.cloud.syncing, caption: null };
    case "offline":
      return { icon: "cloud-offline-outline", color: colors.textMuted, label: t.drive.cloud.offline, caption: null };
    case "error":
      return { icon: "cloud-offline-outline", color: colors.danger, label: t.drive.cloud.error, caption: null };
    default:
      return status.lastSyncAt === null
        ? { icon: "cloud-outline", color: colors.text, label: t.drive.cloud.waiting, caption: null }
        : {
            icon: "cloud-done-outline",
            color: colors.success,
            label: t.drive.cloud.synced(formatDue(status.lastSyncAt)),
            caption: shortTime(status.lastSyncAt),
          };
  }
}

// Icône nuage de l'en-tête de la matrice : état de la synchronisation Google Drive. Un appui :
// se connecter, ou voir l'état et « Synchroniser maintenant ».
export default function CloudButton() {
  const drive = useDriveSync();
  if (!isDriveAvailable()) return null;
  const { icon, color, label, caption } = look(drive.account, drive.status);

  const onPress = () => {
    if (drive.account === null) {
      void drive.connect();
      return;
    }
    showAlert(t.drive.section, `${t.drive.account(drive.account)}\n${syncStatusLine(drive.status)}`, [
      { text: t.drive.close, style: "cancel" },
      { text: t.common.settings, onPress: () => router.push("/settings") },
      { text: t.drive.syncNow, onPress: () => void drive.syncNow() },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={drive.busy && drive.account === null}
      testID="cloud-button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={color} />
      {caption !== null && (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: TOUCH_SIZE,
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: -2,
  },
  pressed: {
    opacity: 0.6,
  },
});
