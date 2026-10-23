import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import IconButton, { IconName } from "../src/components/IconButton";
import { MatrixIllustration } from "../src/components/OnboardingIllustrations";
import { CATEGORIES } from "../src/constants/categories";
import { t } from "../src/i18n";
import { colors, fonts, withAlpha } from "../src/theme";

type Gesture = keyof typeof t.howTo.gestures;

// Icône de chaque geste, dans l'ordre d'affichage
const GESTURE_ICONS: Record<Gesture, IconName> = {
  openQuadrant: "grid-outline",
  add: "add-circle-outline",
  check: "ellipse-outline",
  swipeRight: "arrow-forward",
  swipeLeft: "arrow-back",
  undo: "arrow-undo-outline",
  edit: "create-outline",
  menu: "ellipsis-horizontal",
  waiting: "time-outline",
  soonUrgent: "flame-outline",
  late: "alert-circle-outline",
  pastDue: "calendar-outline",
  recurrence: "repeat",
  done: "checkmark-done-outline",
  notification: "notifications-outline",
  balance: "bar-chart-outline",
  review: "calendar-outline",
  star: "star-outline",
  info: "information-circle-outline",
};

function Heading({ children }: { children: string }) {
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {children}
    </Text>
  );
}

// Page « Comment ça marche » : la méthode d'Eisenhower, les 4 cases et les gestes de l'app
export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label={t.common.back} onPress={() => router.back()} />
        <Text style={styles.title} accessibilityRole="header">
          {t.howTo.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Heading>{t.howTo.methodTitle}</Heading>
        {t.howTo.method.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
        <View style={styles.illustration}>
          <MatrixIllustration />
        </View>

        <Heading>{t.howTo.quadrantsTitle}</Heading>
        {CATEGORIES.map((c) => {
          const { action, examples } = t.howTo.quadrants[c.key];
          return (
            <View
              key={c.key}
              style={[
                styles.quadrant,
                { backgroundColor: withAlpha(c.color, 0.1), borderColor: withAlpha(c.color, 0.35) },
              ]}
            >
              <Text style={[styles.quadrantName, { color: c.textColor }]} accessibilityRole="header">
                {c.name}
              </Text>
              <Text style={styles.quadrantAxis}>{c.axisLabel}</Text>
              <Text style={styles.paragraph}>{action}</Text>
              <Text style={styles.examplesLabel}>{t.howTo.examples}</Text>
              {examples.map((example) => (
                <Text key={example} style={styles.example}>
                  • {example}
                </Text>
              ))}
            </View>
          );
        })}

        <Heading>{t.howTo.weekTitle}</Heading>
        {t.howTo.week.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Heading>{t.howTo.gesturesTitle}</Heading>
        <View style={styles.card}>
          {(Object.keys(GESTURE_ICONS) as Gesture[]).map((gesture, i) => (
            <View key={gesture} style={[styles.gesture, i > 0 && styles.gestureBorder]}>
              <Ionicons name={GESTURE_ICONS[gesture]} size={20} color={colors.textMuted} />
              <Text style={styles.gestureText}>{t.howTo.gestures[gesture]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.text,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    gap: 12,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 4,
    marginTop: 12,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  illustration: {
    marginVertical: 8,
  },
  quadrant: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  quadrantName: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
  },
  quadrantAxis: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  examplesLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  example: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  gesture: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  gestureBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gestureText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
