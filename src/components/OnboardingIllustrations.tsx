import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CATEGORIES, CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { colors, fonts, withAlpha } from "../theme";
import { fitText } from "./fitText";
import { formatDue } from "../format";
import ProgressBar from "./ProgressBar";
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
              <Text style={[styles.cellName, { color: c.textColor }]} {...fitText(nameLines(c.name), 0.6)}>
                {c.name}
              </Text>
              <Text style={styles.cellText} {...fitText(2, 0.85)}>
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

// Écran 3 : une carte qu'on glisse, puis une tâche découpée en étapes avec son avancement
export function GesturesIllustration() {
  const doIt = CATEGORY_BY_KEY.UI;
  return (
    <View style={styles.stack} {...hidden}>
      <View style={styles.swipe}>
        <View style={[styles.swipeAction, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
          <Text style={styles.swipeActionText} {...fitText(1, 0.7)}>
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

      <StepsPreview />
    </View>
  );
}

// Carte avec deux séances, la première cochée : avancement 50 %
function StepsPreview() {
  const plan = CATEGORY_BY_KEY.INU;
  const steps = [1, 2].map((i) => t.steps.session(i, 2, t.steps.durations[60]));
  return (
    <View style={styles.notification}>
      <Text style={styles.cardTitle}>{t.onboarding.sampleTask}</Text>
      {steps.map((title, i) => (
        <View key={title} style={styles.stepRow}>
          <View style={[styles.stepBox, { borderColor: plan.color }, i === 0 && { backgroundColor: plan.color }]}>
            {i === 0 && <Ionicons name="checkmark" size={12} color={plan.onColor} />}
          </View>
          <Text style={[styles.stepText, i === 0 && styles.stepDone]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ))}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <ProgressBar percent={50} color={plan.color} />
        </View>
        <Text style={[styles.progressText, { color: plan.textColor }]}>{t.progress.value(50)}</Text>
      </View>
    </View>
  );
}

// Écran 4 : une semaine du calendrier avec ses points, et une suggestion tirée de la dictée
export function CalendarVoiceIllustration() {
  const colorsOfDays: (keyof typeof CATEGORY_BY_KEY)[][] = [["UI"], [], ["INU", "UDI"], ["INU"], [], ["UI", "NDNI"], []];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 0, 0, 0);
  return (
    <View style={styles.stack} {...hidden}>
      <View style={styles.week}>
        {colorsOfDays.map((cats, i) => (
          <View key={i} style={[styles.weekCell, i === 2 && styles.weekCellSelected]}>
            <Text style={styles.weekNumber}>{12 + i}</Text>
            <View style={styles.weekDots}>
              {cats.map((c) => (
                <View key={c} style={[styles.weekDot, { backgroundColor: CATEGORY_BY_KEY[c].color }]} />
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.voiceRow}>
        <View style={[styles.mic, { backgroundColor: withAlpha(CATEGORY_BY_KEY.INU.color, 0.2), borderColor: CATEGORY_BY_KEY.INU.color }]}>
          <Ionicons name="mic" size={26} color={CATEGORY_BY_KEY.INU.textColor} />
        </View>
        <View style={styles.suggestion}>
          <Ionicons name="sparkles-outline" size={14} color={colors.textMuted} />
          <Text style={styles.suggestionText} {...fitText(2, 0.8)}>
            {t.smart.due(formatDue(tomorrow.getTime()))}
          </Text>
          <Text style={[styles.suggestionAction, { color: CATEGORY_BY_KEY.INU.textColor }]}>{t.smart.apply}</Text>
        </View>
      </View>
    </View>
  );
}

// Écran 6 : un nuage et la dernière sauvegarde
export function DriveIllustration() {
  return (
    <View style={styles.stack} {...hidden}>
      <Ionicons name="cloud-done" size={56} color={CATEGORY_BY_KEY.INU.textColor} style={styles.center} />
      <View style={styles.notification}>
        <View style={styles.notificationHeader}>
          <Ionicons name="logo-google" size={14} color={colors.textMuted} />
          <Text style={styles.appName}>{t.drive.section}</Text>
        </View>
        <Text style={styles.cardTitle}>{t.drive.auto}</Text>
        <Text style={styles.notificationBody}>{t.drive.lastBackup(formatDue(Date.now()))}</Text>
      </View>
    </View>
  );
}

// Notification DoFirst avec ses boutons, comme sur le téléphone
function NotificationPreview() {
  return (
    <View style={styles.notification}>
      <View style={styles.notificationHeader}>
        <View style={[styles.appIcon, { backgroundColor: CATEGORY_BY_KEY.UI.color }]} />
        <Text style={styles.appName}>DoFirst</Text>
      </View>
      <Text style={styles.cardTitle}>{t.onboarding.sampleTask}</Text>
      <Text style={styles.notificationBody}>{t.notifications.nag}</Text>
      <View style={styles.notificationActions}>
        <Text style={styles.notificationAction}>{t.notifications.actionDone}</Text>
        <Text style={styles.notificationAction}>{t.notifications.actionSnooze}</Text>
      </View>
    </View>
  );
}

// Écran 4 : une cloche et la notification de l'écran 3
export function RemindersIllustration() {
  return (
    <View style={styles.stack} {...hidden}>
      <Ionicons name="notifications" size={44} color={CATEGORY_BY_KEY.UI.textColor} style={styles.center} />
      <NotificationPreview />
    </View>
  );
}

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  stepDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
  },
  progressText: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
  },
  week: {
    flexDirection: "row",
    gap: 4,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  weekCellSelected: {
    borderColor: colors.text,
  },
  weekNumber: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  weekDots: {
    flexDirection: "row",
    gap: 3,
    height: 6,
  },
  weekDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mic: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestion: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  suggestionAction: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
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
