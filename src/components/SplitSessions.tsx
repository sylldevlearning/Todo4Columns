import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n";
import { dayLabel } from "../format";
import {
  MAX_SESSIONS,
  MIN_SESSIONS,
  SESSION_MINUTES,
  SplitOptions,
  splitSessions,
} from "../sessions";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { TaskStep } from "../types";
import IconButton from "./IconButton";
import OptionPills from "./OptionPills";

const DURATION_OPTIONS = SESSION_MINUTES.map((m) => ({ label: t.steps.durations[m], value: m }));
const FROM_OPTIONS = [
  { label: t.steps.fromToday, value: 0 },
  { label: t.steps.fromTomorrow, value: 1 },
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
    count: 5,
    minutes: 60,
    from: "tomorrow",
    weekdaysOnly: false,
  });
  const set = (patch: Partial<SplitOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const now = Date.now();
  const sessions = splitSessions(options, now);
  const pills = { color, onColor };

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

            <Text style={styles.label}>{t.steps.duration}</Text>
            <OptionPills
              options={DURATION_OPTIONS}
              value={options.minutes}
              onChange={(v) => v !== null && set({ minutes: v })}
              {...pills}
            />

            <Text style={styles.label}>{t.steps.from}</Text>
            <OptionPills
              options={FROM_OPTIONS}
              value={options.from === "today" ? 0 : 1}
              onChange={(v) => set({ from: v === 0 ? "today" : "tomorrow" })}
              {...pills}
            />

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

            <Text style={styles.label}>{t.steps.preview}</Text>
            <View style={styles.preview} accessibilityLabel={t.steps.preview}>
              {sessions.map((s, i) => (
                <View key={i} style={styles.previewRow}>
                  <Text style={styles.previewTitle}>{s.title}</Text>
                  <Text style={[styles.previewDay, { color: textColor }]}>{dayLabel(s.day!, now)}</Text>
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
              onPress={() => onCreate(sessions)}
              style={({ pressed }) => [styles.create, { backgroundColor: color }, pressed && styles.pressed]}
            >
              <Text style={[styles.createText, { color: onColor }]}>{t.steps.create(sessions.length)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
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
});
