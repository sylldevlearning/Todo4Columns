import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { FAB_SIZE } from "./Fab";

interface Props {
  message: string;
  onUndo: () => void;
}

// Bandeau « Annuler » affiché au-dessus du bouton flottant
export default function UndoBanner({ message, onUndo }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.banner, { bottom: insets.bottom + 20 + FAB_SIZE + 12 }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.undo.action}
        onPress={onUndo}
        style={styles.action}
      >
        <Text style={styles.actionText}>{t.undo.action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  action: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  actionText: {
    color: colors.text,
    fontFamily: fonts.extrabold,
    fontSize: 14,
  },
});
