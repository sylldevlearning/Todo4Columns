import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { usePermissionState } from "../notifications/usePermissionState";
import { useSettingsReady, useSettingsSelector, useTaskActions } from "../store/TasksContext";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";

// Carte discrète de la matrice pour qui a vu la présentation avant la 1.4.1 : l'autorisation des
// notifications n'a jamais été demandée (Android « undetermined ») ni proposée par l'app.
// Affichée une seule fois : dès son apparition, elle est notée comme proposée. Refusée ou déjà
// accordée, elle n'apparaît pas (la carte « Ouvrir les réglages » et Réglages › Notifications
// restent les seuls rappels).
export default function RemindersCard() {
  const ready = useSettingsReady();
  const eligible = useSettingsSelector((s) => s.onboardingDone && !s.remindersPromptDone);
  const [permission] = usePermissionState();
  const { requestNotificationPermission, updateSettings, getSettings } = useTaskActions();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready || !eligible || permission !== "undetermined") return;
    setVisible(true);
    updateSettings({ ...getSettings(), remindersPromptDone: true });
  }, [ready, eligible, permission]);

  if (!visible || permission === "granted") return null;
  const doIt = CATEGORY_BY_KEY.UI;

  const enable = () => {
    setVisible(false);
    requestNotificationPermission().catch(() => {});
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: withAlpha(doIt.color, 0.1), borderColor: withAlpha(doIt.color, 0.3) },
      ]}
      testID="reminders-card"
    >
      <Ionicons name="notifications-outline" size={18} color={doIt.textColor} />
      <Text style={[styles.text, { color: doIt.textColor }]}>{t.remindersCard.body}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setVisible(false)}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.later}>{t.permissionCard.later}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={enable}
        style={({ pressed }) => [
          styles.action,
          styles.enable,
          { backgroundColor: withAlpha(doIt.color, 0.18) },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.enableText, { color: doIt.textColor }]}>{t.remindersCard.enable}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 4,
    columnGap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 2,
  },
  text: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
    fontFamily: fonts.bold,
    fontSize: 14,
    paddingVertical: 8,
  },
  action: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 10,
    borderRadius: 10,
    justifyContent: "center",
  },
  enable: {
    paddingHorizontal: 14,
  },
  later: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textMuted,
  },
  enableText: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
