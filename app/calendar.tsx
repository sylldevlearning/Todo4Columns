import { router } from "expo-router";
import React, { memo, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addMonths,
  calendarEntries,
  CalendarEntry,
  daySummary,
  monthGrid,
  MonthRef,
  monthOf,
  weekStartFor,
} from "../src/calendar";
import CalendarDayPanel from "../src/components/CalendarDayPanel";
import IconButton from "../src/components/IconButton";
import InfoButton from "../src/components/InfoButton";
import { CATEGORY_BY_KEY } from "../src/constants/categories";
import { dayKey, dayStart } from "../src/dates";
import { currentLanguage, t, useLanguage } from "../src/i18n";
import { TasksState, useTasksSelector } from "../src/store/TasksContext";
import { colors, fonts, TOUCH_SIZE, withAlpha, themedStyles, useScheme } from "../src/theme";
import { Category } from "../src/types";

// Glissement horizontal minimal pour changer de mois
const SWIPE_DISTANCE = 60;
const selectTasks = ({ tasks }: TasksState) => tasks;
const EMPTY: CalendarEntry[] = [];

// Vue calendrier : mois, points de couleur par quadrant, panneau du jour choisi
export default function CalendarScreen() {
  useScheme(); // redessiné quand le thème change
  useLanguage(); // textes mis à jour quand la langue change
  const tasks = useTasksSelector(selectTasks);
  const today = dayKey(Date.now());
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  const weekStart = weekStartFor(currentLanguage());

  const grid = useMemo(() => monthGrid(month, weekStart), [month, weekStart]);
  // Contenu des 42 jours affichés, recalculé seulement quand les tâches ou le mois changent
  const entries = useMemo(() => calendarEntries(tasks, grid[0], grid[41]), [tasks, grid]);
  // Jour choisi hors de la grille (après « Aujourd'hui ») : calculé à part
  const selectedEntries = useMemo(
    () => entries.get(selected) ?? (selected < grid[0] || selected > grid[41] ? calendarEntries(tasks, selected, selected).get(selected) : undefined) ?? EMPTY,
    [entries, selected, grid, tasks]
  );

  const changeMonth = (n: number) => setMonth((m) => addMonths(m, n));
  const goToday = () => {
    setMonth(monthOf(today));
    setSelected(today);
  };
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX <= -SWIPE_DISTANCE) changeMonth(1);
      else if (e.translationX >= SWIPE_DISTANCE) changeMonth(-1);
    });

  const monthTitle = new Date(month.year, month.month, 1).toLocaleDateString(t.locale, { month: "long", year: "numeric" });
  const weekdays = grid.slice(0, 7).map((day) => new Date(dayStart(day)).toLocaleDateString(t.locale, { weekday: "narrow" }));
  const openTask = (id: string) => router.push({ pathname: "/task", params: { id } });

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label={t.common.back} onPress={() => router.back()} />
        <Text style={styles.title} accessibilityRole="header">
          {t.calendar.title}
        </Text>
        <InfoButton info="calendar" />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.monthBar}>
          <IconButton icon="chevron-back" label={t.calendar.previous} onPress={() => changeMonth(-1)} />
          <Text style={styles.monthTitle} accessibilityRole="header" accessibilityLiveRegion="polite">
            {monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)}
          </Text>
          <IconButton icon="chevron-forward" label={t.calendar.next} onPress={() => changeMonth(1)} />
          <Pressable accessibilityRole="button" onPress={goToday} style={styles.todayButton}>
            <Text style={styles.todayText}>{t.calendar.today}</Text>
          </Pressable>
        </View>

        <GestureDetector gesture={swipe}>
          <View testID="calendar-grid">
            <View style={styles.week}>
              {weekdays.map((label, i) => (
                <Text key={i} style={styles.weekday} importantForAccessibility="no">
                  {label}
                </Text>
              ))}
            </View>
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <View key={row} style={styles.week}>
                {grid.slice(row * 7, row * 7 + 7).map((day) => {
                  const summary = daySummary(entries.get(day));
                  return (
                    <DayCell
                      key={day}
                      day={day}
                      inMonth={monthOf(day).month === month.month}
                      isToday={day === today}
                      selected={day === selected}
                      count={summary.count}
                      categories={summary.categories.join(",")}
                      onPress={setSelected}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </GestureDetector>

        <CalendarDayPanel day={selected} entries={selectedEntries} onOpenTask={openTask} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Case d'un jour ; mémorisée : choisir un jour ne redessine que deux cases
const DayCell = memo(function DayCell({
  day,
  inMonth,
  isToday,
  selected,
  count,
  categories,
  onPress,
}: {
  day: string;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
  count: number;
  categories: string; // « UI,INU » : chaîne pour que memo compare par valeur
  onPress: (day: string) => void;
}) {
  useScheme(); // mémorisé : redessiné quand le thème change
  const label = new Date(dayStart(day)).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${label}, ${t.matrix.taskCount(count)}` : label}
      accessibilityState={{ selected }}
      onPress={() => onPress(day)}
      style={[styles.cell, selected && styles.cellSelected]}
      testID={`day-${day}`}
    >
      <View style={[styles.dayNumber, isToday && styles.today]}>
        <Text style={[styles.dayText, !inMonth && styles.otherMonth, isToday && styles.todayLabel]}>
          {Number(day.slice(8))}
        </Text>
      </View>
      <View style={styles.dots}>
        {categories !== "" &&
          categories.split(",").map((c) => (
            <View key={c} style={[styles.dot, { backgroundColor: CATEGORY_BY_KEY[c as Category].color }]} />
          ))}
      </View>
      {count > 0 && <Text style={[styles.count, !inMonth && styles.otherMonth]}>{count}</Text>}
    </Pressable>
  );
});

const styles = themedStyles(() =>
  StyleSheet.create({
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
      padding: 12,
      paddingBottom: 48,
    },
    monthBar: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    monthTitle: {
      flex: 1,
      textAlign: "center",
      fontFamily: fonts.bold,
      fontSize: 17,
      color: colors.text,
    },
    todayButton: {
      minHeight: TOUCH_SIZE,
      justifyContent: "center",
      paddingHorizontal: 12,
      marginLeft: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    todayText: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: colors.text,
    },
    week: {
      flexDirection: "row",
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontFamily: fonts.bold,
      fontSize: 12,
      color: colors.textMuted,
      paddingVertical: 6,
    },
    cell: {
      flex: 1,
      minHeight: 62,
      alignItems: "center",
      paddingVertical: 4,
      borderRadius: 12,
      gap: 2,
    },
    cellSelected: {
      backgroundColor: withAlpha(colors.overlay, 0.08),
    },
    dayNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    today: {
      backgroundColor: colors.white,
    },
    dayText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.text,
    },
    todayLabel: {
      color: colors.bg,
    },
    otherMonth: {
      opacity: 0.35,
    },
    dots: {
      flexDirection: "row",
      gap: 3,
      height: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    count: {
      fontFamily: fonts.bold,
      fontSize: 11,
      color: colors.textMuted,
    },
  })
);
