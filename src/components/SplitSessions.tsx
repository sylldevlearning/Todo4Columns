import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t, translated } from "../i18n";
import { dayLabel } from "../format";
import { weekStartFor } from "../calendar";
import { addDays, dayKey, dayStart } from "../dates";
import { currentLanguage } from "../i18n";
import {
  chosenDates,
  MAX_SESSIONS,
  MIN_SESSIONS,
  SESSION_MINUTES,
  SplitMode,
  SplitOptions,
  splitSessions,
} from "../sessions";
import MiniCalendar from "./MiniCalendar";
import { colors, fonts, TOUCH_SIZE, themedStyles } from "../theme";
import { TaskStep } from "../types";
import IconButton from "./IconButton";
import OptionPills from "./OptionPills";

const DURATION_OPTIONS = SESSION_MINUTES.map((m) => translated(() => t.steps.durations[m], m));
const MODES: SplitMode[] = ["consecutive", "weekdays", "dates"];
const MODE_OPTIONS = MODES.map((mode, i) => translated(() => t.splitModes[mode], i));
// Lundi, mercredi, vendredi : proposés au premier passage en « Certains jours de la semaine »
const DEFAULT_WEEK_DAYS = [1, 3, 5];
const FROM_OPTIONS = [
  translated(() => t.steps.fromToday, 0),
  translated(() => t.steps.fromTomorrow, 1),
];

interface Props {
  color: string;
  onColor: string;
  textColor: string;
  onCancel: () => void;
  onCreate: (sessions: TaskStep[]) => void;
}

// « Répartir sur plusieurs jours » : séances d'une durée choisie, une par jour, avec aperçu
export default function SplitSessions({ color, onColor, textColor, onCancel, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState<SplitOptions>({
    mode: "consecutive",
    count: 5,
    minutes: 60,
    from: "tomorrow",
    weekdaysOnly: false,
    weekDays: DEFAULT_WEEK_DAYS,
    dates: [],
  });
  const set = (patch: Partial<SplitOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const now = Date.now();
  const mode = options.mode ?? "consecutive";
  const sessions = splitSessions(options, now);
  const pills = { color, onColor };

  // Changement de mode : le nombre de séances suit les jours choisis
  const chooseMode = (next: SplitMode) => {
    if (next === "weekdays") set({ mode: next, count: Math.max(MIN_SESSIONS, options.weekDays?.length ?? 0) });
    else set({ mode: next });
  };
  // Jours de la semaine (au moins un) : une séance par jour choisi, à prolonger avec +
  const toggleWeekDay = (day: number) => {
    const days = options.weekDays ?? [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    if (next.length === 0) return;
    set({ weekDays: next, count: Math.max(MIN_SESSIONS, next.length) });
  };
  const toggleDate = (day: string) => {
    const dates = options.dates ?? [];
    set({ dates: chosenDates(dates.includes(day) ? dates.filter((d) => d !== day) : [...dates, day], now) });
  };
  // Jours de la semaine dans l'ordre de la langue, avec leur nom court (pris sur une semaine réelle)
  const weekStart = weekStartFor(currentLanguage());
  const today = dayKey(now);
  const sundayBefore = addDays(today, -new Date(now).getDay());
  const weekDayLabels = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7).map((day) => ({
    day,
    label: new Date(dayStart(addDays(sundayBefore, day))).toLocaleDateString(t.locale, { weekday: "short" }),
  }));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          accessibilityViewIsModal
          testID="split-sessions"
        >
          <Text style={styles.title} accessibilityRole="header">
            {t.steps.split}
          </Text>

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.label}>{t.splitModes.label}</Text>
            <OptionPills
              options={MODE_OPTIONS}
              value={MODES.indexOf(mode)}
              onChange={(v) => v !== null && chooseMode(MODES[v])}
              {...pills}
            />

            {mode === "weekdays" && (
              <View style={styles.weekDays}>
                {weekDayLabels.map(({ day, label }) => {
                  const selected = options.weekDays?.includes(day) ?? false;
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={label}
                      onPress={() => toggleWeekDay(day)}
                      style={[styles.weekDay, selected && { backgroundColor: color, borderColor: color }]}
                      testID={"week-day-" + day}
                    >
                      <Text style={[styles.weekDayText, selected && { color: onColor }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {mode === "dates" && (
              <>
                <Text style={styles.hint}>{t.splitModes.datesHint}</Text>
                <MiniCalendar
                  selected={options.dates ?? []}
                  onToggle={toggleDate}
                  color={color}
                  onColor={onColor}
                  max={MAX_SESSIONS}
                  now={now}
                />
              </>
            )}

            {mode !== "dates" && (
              <>
            <Text style={styles.label}>{t.steps.sessions}</Text>
            <View style={styles.stepper}>
              <IconButton
                icon="remove-circle-outline"
                label={t.steps.fewer}
                color={options.count > MIN_SESSIONS ? textColor : colors.border}
                onPress={() => set({ count: Math.max(MIN_SESSIONS, options.count - 1) })}
              />
              <Text style={styles.count} accessibilityLiveRegion="polite">
                {t.steps.sessionsValue(options.count)}
              </Text>
              <IconButton
                icon="add-circle-outline"
                label={t.steps.more}
                color={options.count < MAX_SESSIONS ? textColor : colors.border}
                onPress={() => set({ count: Math.min(MAX_SESSIONS, options.count + 1) })}
              />
            </View>
              </>
            )}

            <Text style={styles.label}>{t.steps.duration}</Text>
            <OptionPills
              options={DURATION_OPTIONS}
              value={options.minutes}
              onChange={(v) => v !== null && set({ minutes: v })}
              {...pills}
            />

            {mode !== "dates" && (
              <>
                <Text style={styles.label}>{t.steps.from}</Text>
                <OptionPills
                  options={FROM_OPTIONS}
                  value={options.from === "today" ? 0 : 1}
                  onChange={(v) => set({ from: v === 0 ? "today" : "tomorrow" })}
                  {...pills}
                />
              </>
            )}

            {mode === "consecutive" && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t.steps.weekdaysOnly}</Text>
                <Switch
                  accessibilityLabel={t.steps.weekdaysOnly}
                  value={options.weekdaysOnly}
                  onValueChange={(weekdaysOnly) => set({ weekdaysOnly })}
                  trackColor={{ false: colors.border, true: color }}
                  thumbColor={colors.white}
                />
              </View>
            )}

            <Text style={styles.label}>{t.steps.preview}</Text>
            <View style={styles.preview} accessibilityLabel={t.steps.preview}>
              {sessions.length === 0 && <Text style={styles.hint}>{t.splitModes.tooFew}</Text>}
              {sessions.map((s, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewTitle}>{s.title}</Text>
                  <Text style={[styles.previewDay, { color: textColor }]}>
                    {s.time ? t.steps.dayAt(dayLabel(s.day!, now), s.time) : dayLabel(s.day!, now)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: sessions.length === 0 }}
              disabled={sessions.length === 0}
              onPress={() => onCreate(sessions)}
              style={({ pressed }) => [
                styles.create,
                { backgroundColor: color },
                sessions.length === 0 && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.createText, { color: onColor }]}>
                {t.steps.create(Math.max(sessions.length, MIN_SESSIONS))}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.backdrop,
    },
    sheet: {
      maxHeight: "88%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 20,
      paddingHorizontal: 20,
      gap: 12,
    },
    title: {
      fontFamily: fonts.extrabold,
      fontSize: 20,
      color: colors.text,
    },
    content: {
      gap: 10,
      paddingBottom: 8,
    },
    label: {
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginTop: 4,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    count: {
      minWidth: 110,
      textAlign: "center",
      fontFamily: fonts.bold,
      fontSize: 16,
      color: colors.text,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      gap: 12,
    },
    switchLabel: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: colors.text,
    },
    preview: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    previewRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 6,
    },
    previewTitle: {
      flexShrink: 1,
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.text,
    },
    previewDay: {
      fontFamily: fonts.semibold,
      fontSize: 13,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
    },
    cancel: {
      minHeight: TOUCH_SIZE + 6,
      paddingHorizontal: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    cancelText: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: colors.text,
    },
    create: {
      flex: 1,
      minHeight: TOUCH_SIZE + 6,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    createText: {
      fontFamily: fonts.extrabold,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.4,
    },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    weekDays: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    weekDay: {
      minWidth: 44,
      minHeight: TOUCH_SIZE,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    weekDayText: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: colors.text,
    },
  })
);
