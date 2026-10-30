import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CATEGORIES, CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { colors, fonts, withAlpha } from "../theme";
import { nameLines } from "./MatrixGrid";


// Illustrations de la présentation, dessinées en composants (aucune image).
// Décoratives : le texte de chaque écran suffit aux lecteurs d'écran.
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

// Largeur de l'action révélée par le glissement
const SWIPE_WIDTH = 110;

// Écran 1 : la grille 2×2 aux couleurs des quadrants
export function MatrixIllustration() {
  const rows = [CATEGORIES.slice(0, 2), CATEGORIES.slice(2, 4)];
  return (
    <View style={styles.matrix} {...hidden}>
      <View style={styles.axisRow}>
        <Text style={styles.axis}>{t.matrix.urgent}</Text>
        <Text style={styles.axis}>{t.matrix.notUrgent}</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((c) => (
            <View
              key={c.key}
              style={[
                styles.cell,
                { backgroundColor: withAlpha(c.color, 0.14), borderColor: withAlpha(c.color, 0.45) },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text
                style={[styles.cellName, { color: c.textColor }]}
                numberOfLines={nameLines(c.name)}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {c.name}
              </Text>
              <Text style={styles.cellText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
                {c.subtitle}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <View style={styles.axisRow}>
        <Text style={styles.axis}>↑ {t.matrix.important}</Text>
        <Text style={styles.axis}>↓ {t.matrix.notImportant}</Text>
      </View>
    </View>
  );
}

function FakeSwitch({ on, color }: { on: boolean; color: string }) {
  return (
    <View style={[styles.track, { backgroundColor: on ? color : colors.border }]}>
      <View style={[styles.thumb, on ? styles.thumbOn : null]} />
    </View>
  );
}

// Écran 2 : les deux questions, puis la case choisie par l'app
export function CreateIllustration() {
  const doIt = CATEGORY_BY_KEY.UI;
  return (
    <View style={styles.stack} {...hidden}>
      <View style={styles.panel}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t.form.urgentQuestion}</Text>
          <FakeSwitch on color={doIt.color} />
        </View>
        <View style={styles.separator} />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t.form.importantQuestion}</Text>
          <FakeSwitch on color={doIt.color} />
        </View>
      </View>
      <Ionicons name="arrow-down" size={22} color={colors.textMuted} style={styles.center} />
      <View
        style={[
          styles.result,
          { backgroundColor: withAlpha(doIt.color, 0.14), borderColor: withAlpha(doIt.color, 0.45) },
        ]}
      >
        <Text style={[styles.resultName, { color: doIt.textColor }]}>→ {doIt.name}</Text>
        <Text style={styles.resultText}>{doIt.description}</Text>
      </View>
    </View>
  );
}

// Écran 3 : une carte qu'on glisse, et une notification avec ses boutons
export function GesturesIllustration() {
  const doIt = CATEGORY_BY_KEY.UI;
  return (
    <View style={styles.stack} {...hidden}>
      <View style={styles.swipe}>
        <View style={[styles.swipeAction, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
          <Text style={styles.swipeActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t.onboarding.swipeRight}
          </Text>
        </View>
        <View style={styles.swipedCard}>
          <View style={[styles.circle, { borderColor: doIt.color }]} />
          <Text style={styles.cardTitle} numberOfLines={1}>
            {t.onboarding.sampleTask}
          </Text>
        </View>
      </View>
      <View style={styles.hints}>
        <Text style={[styles.hint, { color: colors.danger }]}>← {t.onboarding.swipeLeft}</Text>
        <Text style={[styles.hint, { color: colors.success }]}>{t.onboarding.swipeRight} →</Text>
      </View>

      <View style={styles.notification}>
        <View style={styles.notificationHeader}>
          <View style={[styles.appIcon, { backgroundColor: doIt.color }]} />
          <Text style={styles.appName}>DoFirst</Text>
        </View>
        <Text style={styles.cardTitle}>{t.onboarding.sampleTask}</Text>
        <Text style={styles.notificationBody}>{t.notifications.nag}</Text>
        <View style={styles.notificationActions}>
          <Text style={styles.notificationAction}>{t.notifications.actionDone}</Text>
          <Text style={styles.notificationAction}>{t.notifications.actionSnooze}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  matrix: {
    gap: 8,
  },
  axisRow: {
    flexDirection: "row",
    gap: 8,
  },
  axis: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  gridRow: {
    flexDirection: "row",
    gap: 8,
  },
  cell: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cellName: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
  },
  cellText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  stack: {
    gap: 12,
  },
  center: {
    alignSelf: "center",
  },
  panel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
  },
  switchLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  thumbOn: {
    alignSelf: "flex-end",
  },
  result: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  resultName: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
  },
  resultText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  swipe: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.success,
  },
  swipeAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_WIDTH, // le texte réduit sa taille pour tenir à côté de la carte
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  swipeActionText: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
  },
  swipedCard: {
    marginLeft: SWIPE_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  cardTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  hints: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  hint: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  notification: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 2,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  appIcon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  appName: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  notificationBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  notificationActions: {
    flexDirection: "row",
    gap: 24,
    marginTop: 10,
  },
  notificationAction: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: CATEGORY_BY_KEY.INU.textColor,
  },
});
