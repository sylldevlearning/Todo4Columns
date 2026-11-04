import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ComponentProps } from "react";
import { Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { colors, TOUCH_SIZE } from "../theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  icon: IconName;
  label: string; // lu par les lecteurs d'écran
  onPress: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// Bouton-icône avec une zone tactile de 44 px
export default function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  size = 22,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: TOUCH_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
