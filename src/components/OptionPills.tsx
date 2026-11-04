import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ReminderOption } from "../reminders";
import { colors, fonts, TOUCH_SIZE } from "../theme";

interface Props {
  options: ReminderOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  color: string; // couleur du quadrant pour l'option choisie
  onColor: string;
}

// Choix unique présenté sous forme de pastilles
export default function OptionPills({ options, value, onChange, color, onColor }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.pill,
              selected ? { backgroundColor: color, borderColor: color } : null,
            ]}
          >
            <Text style={[styles.label, { color: selected ? onColor : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
