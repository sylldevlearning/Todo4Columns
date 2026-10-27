import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowOpen } from "../appWindows";
import { t } from "../i18n";
import { noteUndo } from "../reviewPrompt";
import {
  TasksState,
  useSettingsReady,
  useSettingsSelector,
  useTaskActions,
  useTasksSelector,
} from "../store/TasksContext";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { FAB_SIZE } from "./Fab";

// Durée d'affichage du message
export const NOTICE_MS = 8000;

const selectEscalation = ({ escalation }: TasksState) => escalation;

// Message discret après une bascule automatique en Faire, avec « Annuler »
export default function EscalationNotice() {
  const escalation = useTasksSelector(selectEscalation);
  const { undoEscalation, dismissEscalation } = useTaskActions();
  const insets = useSafeAreaInsets();
  // Jamais par-dessus la présentation du premier lancement : le message attend qu'elle soit
  // terminée, et ses 8 secondes ne commencent qu'à ce moment
  const settingsReady = useSettingsReady();
  const onboardingDone = useSettingsSelector((s) => s.onboardingDone);
  const visible = escalation !== null && settingsReady && onboardingDone;
  useWindowOpen("escalationNotice", visible);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(dismissEscalation, NOTICE_MS);
    return () => clearTimeout(timeout);
  }, [visible, escalation]);

  if (!visible) return null;
  const message = t.escalation.escalated(escalation.before.length);

  return (
    <View
      style={[styles.notice, { bottom: insets.bottom + 20 + FAB_SIZE + 12 }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.undo.action} : ${message}`}
        onPress={() => {
          noteUndo();
          undoEscalation();
        }}
        style={styles.action}
      >
        <Text style={styles.actionText}>{t.undo.action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 12,
  },
  action: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  actionText: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    color: colors.text,
  },
});
