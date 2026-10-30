import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  anticipated,
  Counts,
  MIN_FOR_BALANCE,
  totalOf,
  WeekCounts,
  weeklyHistory,
} from "../src/balance";
import BalanceBar, { describeCounts } from "../src/components/BalanceBar";
import IconButton from "../src/components/IconButton";
import InfoButton from "../src/components/InfoButton";
import { CATEGORIES } from "../src/constants/categories";
import { formatWeekStart } from "../src/format";
import { t, useLanguage } from "../src/i18n";
import { selectCompletions, useTasksSelector } from "../src/store/TasksContext";
import { colors, fonts } from "../src/theme";


// Hauteur de la colonne de la semaine la plus chargée
const COLUMN_HEIGHT = 140;

// Nombre de tâches par quadrant, sous la barre de la semaine en cours
function Legend({ counts }: { counts: Counts }) {
  return (
    <View style={styles.legend}>
      {CATEGORIES.map((c) => (
        <View key={c.key} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: c.color }]} />
          <Text style={styles.legendText}>
            {c.name} · {counts[c.key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

// Colonnes empilées des semaines précédentes, de la plus ancienne à la plus récente
function WeekColumns({ weeks }: { weeks: WeekCounts[] }) {
  const max = Math.max(1, ...weeks.map((w) => totalOf(w.counts)));
  return (
    <View style={styles.columns}>
      {weeks.map(({ start, counts }) => {
        const total = totalOf(counts);
        const label = t.balance.weekOf(formatWeekStart(start));
        return (
          <View
            key={start}
            style={styles.column}
            accessible
            accessibilityLabel={`${label} : ${
              total === 0 ? t.balance.empty : `${t.balance.done(total)}, ${describeCounts(counts)}`
            }`}
          >
            <Text style={styles.columnTotal}>{total}</Text>
            <View style={styles.columnTrack}>
              <View style={[styles.stack, { height: (COLUMN_HEIGHT * total) / max }]}>
                {/* « Faire » en haut, « Si j'ai le temps » en bas */}
                {CATEGORIES.filter((c) => counts[c.key] > 0).map((c) => (
                  <View key={c.key} style={{ flex: counts[c.key], backgroundColor: c.color }} />
                ))}
              </View>
            </View>
            <Text style={styles.columnLabel}>{formatWeekStart(start)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Écran « Bilan » : la semaine en cours, puis les 4 semaines précédentes
export default function BalanceScreen() {
  useLanguage(); // textes mis à jour quand la langue change
  const completed = useTasksSelector(selectCompletions);
  const [current, ...previous] = weeklyHistory(completed, Date.now());
  const total = totalOf(current.counts);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label={t.common.back} onPress={() => router.back()} />
        <Text style={styles.title} accessibilityRole="header">
          {t.balance.title}
        </Text>
        <InfoButton info="balance" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">
          {t.balance.thisWeek}
        </Text>
        <View style={styles.card}>
          <BalanceBar counts={current.counts} height={16} />
          <Text style={styles.summary}>
            {total >= MIN_FOR_BALANCE
              ? t.balance.anticipated(anticipated(current.counts), total)
              : t.balance.notEnough}
          </Text>
          <Legend counts={current.counts} />
        </View>

        <Text style={styles.heading} accessibilityRole="header">
          {t.balance.previousWeeks}
        </Text>
        <View style={styles.card}>
          <WeekColumns weeks={[...previous].reverse()} />
        </View>

        <Text style={styles.insight}>{t.balance.insight}</Text>
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
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  summary: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  columns: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  columnTotal: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  columnTrack: {
    height: COLUMN_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stack: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: "hidden",
    gap: 2,
  },
  columnLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  insight: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    paddingHorizontal: 4,
    marginTop: 4,
  },
});
