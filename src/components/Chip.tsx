import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, withAlpha } from "../theme";
import { IconName } from "./IconButton";

interface Props {
  icon: IconName;
  label: string;
  color: string; // couleur du quadrant (fond)
  textColor: string;
}

// Petite puce d'information : minuteur, échéance, rappel…
export default function Chip({ icon, label, color, textColor }: Props) {
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.14) }]}>
      <Ionicons name={icon} size={12} color={textColor} />
      <Text
        style={[styles.label, { color: textColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 1,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
