import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, themedStyles } from "../theme";

export const FAB_SIZE = 60;
export const MIC_FAB_SIZE = 52;

interface Props {
  onPress: () => void;
  onLongPress?: () => void;
  longPressHint?: string; // lu par les lecteurs d'écran (« appui long : … »)
  label: string;
  color?: string; // fond
  iconColor?: string;
}

// Bouton flottant « + » en bas à droite
export default function Fab({
  onPress,
  onLongPress,
  longPressHint,
  label,
  color = colors.white,
  iconColor = colors.bg,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={longPressHint}
      accessibilityActions={onLongPress ? [{ name: "longpress" }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && onLongPress?.()}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: color, bottom: insets.bottom + 20 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="add" size={32} color={iconColor} />
    </Pressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    fab: {
      position: "absolute",
      right: 20,
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      elevation: 6,
      shadowColor: colors.shadow,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    pressed: {
      transform: [{ scale: 0.96 }],
    },
    mic: {
      width: MIC_FAB_SIZE,
      height: MIC_FAB_SIZE,
      borderRadius: MIC_FAB_SIZE / 2,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
  })
);


// Bouton micro, à gauche du « + » : ouvre la fiche et lance la dictée
export function MicFab({ onPress, label }: { onPress: () => void; label: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        styles.mic,
        { right: 20 + FAB_SIZE + 12, bottom: insets.bottom + 20 + (FAB_SIZE - MIC_FAB_SIZE) / 2 },
        pressed && styles.pressed,
      ]}
      testID="mic-fab"
    >
      <Ionicons name="mic" size={26} color={colors.text} />
    </Pressable>
  );
}
