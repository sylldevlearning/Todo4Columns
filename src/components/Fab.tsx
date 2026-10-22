import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";

export const FAB_SIZE = 60;

interface Props {
  onPress: () => void;
  label: string;
  color?: string; // fond
  iconColor?: string;
}

// Bouton flottant « + » en bas à droite
export default function Fab({
  onPress,
  label,
  color = colors.white,
  iconColor = colors.bg,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
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

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
