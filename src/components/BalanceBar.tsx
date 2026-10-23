import React from "react";
import { StyleSheet, View } from "react-native";
import { Counts, totalOf } from "../balance";
import { CATEGORIES } from "../constants/categories";
import { t } from "../i18n";
import { colors } from "../theme";

// Résumé lu par les lecteurs d'écran : « Faire 2, Planifier 6… »
export const describeCounts = (counts: Counts) =>
  CATEGORIES.map((c) => t.balance.part(c.name, counts[c.key])).join(", ");

interface Props {
  counts: Counts;
  height?: number;
}

// Barre horizontale découpée aux couleurs des 4 quadrants, selon les tâches terminées
export default function BalanceBar({ counts, height = 12 }: Props) {
  const total = totalOf(counts);
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessible
      accessibilityLabel={total === 0 ? t.balance.empty : t.balance.barLabel(describeCounts(counts))}
    >
      {CATEGORIES.filter((c) => counts[c.key] > 0).map((c) => (
        <View key={c.key} style={{ flex: counts[c.key], backgroundColor: c.color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: colors.border,
    gap: 2,
  },
});
