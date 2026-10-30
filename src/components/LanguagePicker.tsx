import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LANGUAGE_NAMES, LANGUAGES, LanguagePreference, t } from "../i18n";
import { colors, fonts, TOUCH_SIZE } from "../theme";

const OPTIONS: LanguagePreference[] = ["auto", ...LANGUAGES];

// Automatique dans la langue courante ; chaque langue sous son nom natif
const labelOf = (option: LanguagePreference) =>
  option === "auto" ? t.settings.languageAuto : LANGUAGE_NAMES[option];

interface Props {
  value: LanguagePreference;
  onChange: (value: LanguagePreference) => void;
}

// Réglage « Langue » : la langue choisie, et la liste des langues une fois ouverte
export default function LanguagePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.settings.language}, ${labelOf(value)}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.current}
      >
        <Text style={styles.currentLabel}>{labelOf(value)}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View accessibilityRole="radiogroup" style={styles.list}>
          {OPTIONS.map((option) => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setOpen(false);
                  if (!selected) onChange(option);
                }}
                style={styles.option}
              >
                <Text style={[styles.optionLabel, selected && styles.optionSelected]}>
                  {labelOf(option)}
                </Text>
                {selected && <Ionicons name="checkmark" size={18} color={colors.text} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  current: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: TOUCH_SIZE,
    gap: 12,
  },
  currentLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: TOUCH_SIZE,
    gap: 12,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
  },
  optionSelected: {
    fontFamily: fonts.bold,
    color: colors.text,
  },
});
