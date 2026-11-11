import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { addMonths, monthGrid, MonthRef, monthOf, weekStartFor } from "../calendar";
import { dayKey, dayStart } from "../dates";
import { currentLanguage, t } from "../i18n";
import { colors, fonts, themedStyles } from "../theme";
import IconButton from "./IconButton";

interface Props {
  selected: string[]; // jours choisis « 2026-11-12 »
  onToggle: (day: string) => void;
  color: string;
  onColor: string;
  max: number; // nombre de jours au plus
  now: number;
}

// Mini-calendrier à sélection multiple (« Dates précises ») ; jours passés non sélectionnables
export default function MiniCalendar({ selected, onToggle, color, onColor, max, now }: Props) {
  const today = dayKey(now);
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));
  const grid = monthGrid(month, weekStartFor(currentLanguage()));
  const title = new Date(month.year, month.month, 1).toLocaleDateString(t.locale, { month: "long", year: "numeric" });
  const full = selected.length >= max;
  const firstMonth = monthOf(today);
  const canGoBack = month.year > firstMonth.year || (month.year === firstMonth.year && month.month > firstMonth.month);

  return (
    <View style={styles.container} testID="mini-calendar">
      <View style={styles.header}>
        <IconButton
          icon="chevron-back"
          label={t.splitModes.previousMonth}
          color={canGoBack ? colors.text : colors.border}
          onPress={() => canGoBack && setMonth((m) => addMonths(m, -1))}
        />
        <Text style={styles.title} accessibilityLiveRegion="polite">
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
        <IconButton icon="chevron-forward" label={t.splitModes.nextMonth} onPress={() => setMonth((m) => addMonths(m, 1))} />
      </View>
      <View style={styles.week}>
        {grid.slice(0, 7).map((day) => (
          <Text key={day} style={styles.weekday} importantForAccessibility="no">
            {new Date(dayStart(day)).toLocaleDateString(t.locale, { weekday: "narrow" })}
          </Text>
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} style={styles.week}>
          {grid.slice(row * 7, row * 7 + 7).map((day) => {
            const isSelected = selected.includes(day);
            const disabled = day < today || (!isSelected && full);
            const inMonth = monthOf(day).month === month.month;
            return (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled }}
                accessibilityLabel={new Date(dayStart(day)).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })}
                disabled={disabled}
                onPress={() => onToggle(day)}
                style={styles.cell}
                testID={`mini-day-${day}`}
              >
                <View style={[styles.circle, isSelected && { backgroundColor: color }]}>
                  <Text
                    style={[
                      styles.dayText,
                      (!inMonth || day < today) && styles.faded,
                      isSelected && { color: onColor },
                      day === today && !isSelected && styles.today,
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      padding: 6,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.text,
    },
    week: {
      flexDirection: "row",
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontFamily: fonts.bold,
      fontSize: 11,
      color: colors.textMuted,
      paddingVertical: 4,
    },
    cell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 2,
    },
    circle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    dayText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.text,
    },
    faded: {
      opacity: 0.35,
    },
    today: {
      textDecorationLine: "underline",
    },
  })
);
