import React from "react";
import { StyleSheet, View } from "react-native";
import { t } from "../i18n";
import { colors, withAlpha, themedStyles } from "../theme";

// Barre fine d'avancement (carte, fiche, panneau rapide)
export default function ProgressBar({ percent, color, height = 4 }: { percent: number; color: string; height?: number }) {
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: withAlpha(color, 0.18) }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t.progress.label}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: t.progress.value(percent) }}
      testID="progress-bar"
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    track: {
      overflow: "hidden",
      backgroundColor: colors.border,
    },
    fill: {
      height: "100%",
    },
  })
);
