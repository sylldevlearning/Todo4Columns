import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CategoryInfo, CATEGORIES } from "../constants/categories";
import { t } from "../i18n";
import { isPriority } from "../review";
import { stepProgress, stepsOf } from "../steps";
import { colors, fonts, withAlpha } from "../theme";
import { Category, Task } from "../types";
import TaskChips from "./TaskChips";

const PREVIEW_COUNT = 3;

interface Props {
  tasks: Task[];
  onOpenQuadrant: (category: Category) => void;
}

function QuadrantCell({
  category,
  tasks,
  onPress,
}: {
  category: CategoryInfo;
  tasks: Task[]; // tâches non terminées du quadrant
  onPress: () => void;
}) {
  // Priorités de la semaine en tête de l'aperçu
  const now = Date.now();
  const preview = [
    ...tasks.filter((t) => isPriority(t, now)),
    ...tasks.filter((t) => !isPriority(t, now)),
  ].slice(0, PREVIEW_COUNT);
  const others = tasks.length - preview.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.matrix.cellLabel(category.name, tasks.length)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        {
          backgroundColor: withAlpha(category.color, 0.11),
          borderColor: withAlpha(category.color, 0.35),
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cellHeader}>
        <View style={[styles.dot, { backgroundColor: category.color }]} />
        <Text style={[styles.name, { color: category.textColor }]} numberOfLines={2}>
          {category.name}
        </Text>
        <View style={[styles.count, { backgroundColor: category.color }]}>
          <Text style={[styles.countText, { color: category.onColor }]}>
            {tasks.length}
          </Text>
        </View>
      </View>
      <Text style={styles.subtitle} numberOfLines={1}>
        {category.subtitle}
      </Text>

      <View style={styles.preview}>
        {preview.map((task) => {
          const progress = stepProgress(stepsOf(task));
          return (
            <View key={task.id} style={styles.previewTask}>
              <View style={styles.previewTitleRow}>
                {isPriority(task, now) && (
                  <Ionicons
                    name="star"
                    size={11}
                    color={colors.warning}
                    accessibilityLabel={t.review.priority}
                  />
                )}
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                {/* Étapes : progression discrète à côté du titre */}
                {progress && (
                  <Text
                    style={styles.progress}
                    accessibilityLabel={t.steps.progressLabel(progress.done, progress.total)}
                  >
                    {t.steps.progress(progress.done, progress.total)}
                  </Text>
                )}
              </View>
              <TaskChips task={task} category={category} compact />
            </View>
          );
        })}
        {others > 0 && (
          <Text style={styles.others}>
            {t.matrix.others(others)}
          </Text>
        )}
        {tasks.length === 0 && <Text style={styles.empty}>{t.matrix.empty}</Text>}
      </View>
    </Pressable>
  );
}

// Grille 2×2 avec les axes Urgent / Pas urgent et Important / Pas important
export default function MatrixGrid({ tasks, onOpenQuadrant }: Props) {
  const openTasks = (key: Category) =>
    tasks.filter((t) => t.category === key && !t.isDone && t.archivedAt === null);
  const rows = [CATEGORIES.slice(0, 2), CATEGORIES.slice(2, 4)];
  const rowLabels = [t.matrix.important, t.matrix.notImportant];

  return (
    <View style={styles.container}>
      <View style={styles.topAxis}>
        <View style={styles.sideAxis} />
        <Text style={styles.axisLabel}>{t.matrix.urgent}</Text>
        <Text style={styles.axisLabel}>{t.matrix.notUrgent}</Text>
      </View>

      {rows.map((row, i) => (
        <View key={rowLabels[i]} style={styles.row}>
          <View style={styles.sideAxis}>
            <Text style={[styles.axisLabel, styles.vertical]} numberOfLines={1}>
              {rowLabels[i]}
            </Text>
          </View>
          {row.map((category) => (
            <QuadrantCell
              key={category.key}
              category={category}
              tasks={openTasks(category.key)}
              onPress={() => onOpenQuadrant(category.key)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const AXIS_WIDTH = 22;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  topAxis: {
    flexDirection: "row",
    gap: 10,
  },
  axisLabel: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  sideAxis: {
    width: AXIS_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  vertical: {
    flex: 0,
    width: 160,
    transform: [{ rotate: "-90deg" }],
  },
  cell: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.8,
  },
  cellHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flex: 1,
    fontFamily: fonts.extrabold,
    fontSize: 17,
  },
  count: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  preview: {
    marginTop: 10,
    gap: 8,
  },
  previewTask: {
    gap: 0,
  },
  previewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewTitle: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
  progress: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
  },
  others: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
