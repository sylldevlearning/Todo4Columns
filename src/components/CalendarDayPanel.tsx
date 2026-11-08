import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BLOCK_MINUTES, byCategory, CalendarEntry, dayTimeline } from "../calendar";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { dayStart } from "../dates";
import { formatDay } from "../format";
import { t } from "../i18n";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";

// Hauteur d'une heure sur la frise
export const HOUR_HEIGHT = 56;
const BLOCK_HEIGHT = (BLOCK_MINUTES / 60) * HOUR_HEIGHT;

interface Props {
  day: string; // « 2026-11-08 »
  entries: CalendarEntry[];
  onOpenTask: (taskId: string) => void;
}

// Panneau d'un jour : nombre de tâches, répartition par quadrant, frise horaire, « Sans heure »
export default function CalendarDayPanel({ day, entries, onOpenTask }: Props) {
  const timeline = dayTimeline(entries);
  const hours = Array.from({ length: timeline.endHour - timeline.startHour }, (_, i) => timeline.startHour + i);

  return (
    <View style={styles.panel} testID="calendar-day-panel">
      <Text style={styles.title} accessibilityRole="header">
        {formatDay(dayStart(day))}
      </Text>
      <Text style={styles.count}>{t.matrix.taskCount(entries.length)}</Text>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{t.calendar.empty}</Text>
      ) : (
        <>
          <View style={styles.breakdown}>
            {byCategory(entries).map(({ category, count }) => {
              const info = CATEGORY_BY_KEY[category];
              return (
                <View
                  key={category}
                  style={[styles.pill, { backgroundColor: withAlpha(info.color, 0.16), borderColor: withAlpha(info.color, 0.4) }]}
                >
                  <View style={[styles.dot, { backgroundColor: info.color }]} />
                  <Text style={[styles.pillText, { color: info.textColor }]}>
                    {info.name} · {count}
                  </Text>
                </View>
              );
            })}
          </View>

          {timeline.blocks.length > 0 && (
            <View style={[styles.timeline, { height: hours.length * HOUR_HEIGHT }]} testID="calendar-timeline">
              {hours.map((hour, i) => (
                <View key={hour} style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}>
                  <Text style={styles.hourLabel}>{`${String(hour).padStart(2, "0")}:00`}</Text>
                  <View style={styles.hourLine} />
                </View>
              ))}
              <View style={styles.blocks}>
                {timeline.blocks.map((block) => (
                  <View
                    key={block.entry.key}
                    style={[
                      styles.blockSlot,
                      {
                        top: ((block.minutes - timeline.startHour * 60) / 60) * HOUR_HEIGHT,
                        height: BLOCK_HEIGHT,
                        left: `${(block.column / block.columns) * 100}%`,
                        width: `${100 / block.columns}%`,
                      },
                    ]}
                  >
                    <EntryRow entry={block.entry} compact onOpenTask={onOpenTask} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {timeline.untimed.length > 0 && (
            <View style={styles.untimed}>
              <Text style={styles.sectionTitle}>{t.calendar.noTime}</Text>
              {timeline.untimed.map((entry) => (
                <EntryRow key={entry.key} entry={entry} onOpenTask={onOpenTask} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// Une tâche du jour ; les occurrences prévues d'une tâche récurrente ne s'ouvrent pas
function EntryRow({
  entry,
  compact = false,
  onOpenTask,
}: {
  entry: CalendarEntry;
  compact?: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const info = CATEGORY_BY_KEY[entry.category];
  const planned = entry.kind === "planned";
  const subtitle = [entry.time, entry.stepTitle !== null ? t.calendar.step(entry.stepTitle) : null, planned ? t.calendar.planned : null]
    .filter(Boolean)
    .join(" · ");
  const content = (
    <View
      style={[
        styles.entry,
        compact && styles.entryCompact,
        { borderLeftColor: info.color, backgroundColor: withAlpha(info.color, planned ? 0.06 : 0.14) },
        planned && [styles.planned, { borderColor: withAlpha(info.color, 0.6) }],
        entry.done && styles.done,
      ]}
    >
      <Text style={[styles.entryTitle, entry.done && styles.doneText]} numberOfLines={1}>
        {entry.title}
      </Text>
      {subtitle !== "" && (
        <Text style={styles.entrySubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );
  const label = [entry.title, subtitle].filter(Boolean).join(", ");
  if (planned) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        accessibilityHint={t.calendar.plannedHint}
        style={compact && styles.fill}
        testID={`entry-${entry.key}`}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ checked: entry.done }}
      onPress={() => onOpenTask(entry.taskId)}
      style={({ pressed }) => [compact && styles.fill, pressed && styles.pressed]}
      testID={`entry-${entry.key}`}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    color: colors.text,
  },
  count: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: -8,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  breakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  timeline: {
    position: "relative",
  },
  hourRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  hourLabel: {
    width: 48,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -7,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  blocks: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 52,
    right: 0,
  },
  blockSlot: {
    position: "absolute",
    paddingRight: 4,
  },
  untimed: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  entry: {
    minHeight: TOUCH_SIZE,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  entryCompact: {
    flex: 1,
    minHeight: 0,
    height: "100%",
    paddingVertical: 2,
  },
  planned: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderStyle: "dashed",
  },
  done: {
    opacity: 0.45,
  },
  doneText: {
    textDecorationLine: "line-through",
  },
  entryTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
  entrySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.6,
  },
  fill: {
    flex: 1,
  },
});
