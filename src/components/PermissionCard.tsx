import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect } from "react";
import { AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowOpen } from "../appWindows";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { hidePermissionCard, usePermissionCardVisible } from "../notifications/permissionCard";
import { getPermissionState, openSystemSettings } from "../notifications/setup";
import { useTaskActions } from "../store/TasksContext";
import { colors, fonts, TOUCH_SIZE } from "../theme";

// Notifications refusées et fenêtre système plus disponible : propose les réglages du téléphone.
// Au retour dans l'app, l'autorisation est relue ; accordée, la carte se ferme et les rappels
// sont programmés.
export default function PermissionCard() {
  const visible = usePermissionCardVisible();
  const { resyncNotifications } = useTaskActions();
  const insets = useSafeAreaInsets();
  useWindowOpen("permissionCard", visible);

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      getPermissionState()
        .then((permission) => {
          if (permission !== "granted") return;
          hidePermissionCard();
          resyncNotifications();
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, [visible]);

  if (!visible) return null;
  const doIt = CATEGORY_BY_KEY.UI;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={hidePermissionCard}
      testID="permission-card"
    >
      <Pressable
        style={styles.backdrop}
        onPress={hidePermissionCard}
        accessibilityRole="button"
        accessibilityLabel={t.permissionCard.later}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Ionicons name="notifications-off-outline" size={32} color={doIt.textColor} />
        <Text style={styles.body} accessibilityRole="header">
          {t.permissionCard.body}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={openSystemSettings}
          style={({ pressed }) => [styles.primary, { backgroundColor: doIt.color }, pressed && styles.pressed]}
        >
          <Text style={[styles.primaryText, { color: doIt.onColor }]}>{t.permissionCard.openSettings}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={hidePermissionCard} style={styles.secondary}>
          <Text style={styles.secondaryText}>{t.permissionCard.later}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  primary: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryText: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
  },
  secondary: {
    minHeight: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
  },
});
