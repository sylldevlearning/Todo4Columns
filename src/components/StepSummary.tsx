import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CategoryInfo } from "../constants/categories";
import { t } from "../i18n";
import { lateSteps, stepProgress, stepsOf, todayStep } from "../steps";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { Task, TaskStep } from "../types";

interface Props {
  task: Task;
  category: CategoryInfo;
  now: number;
  onCheck: (step: TaskStep) => void; // étape cochée depuis la carte
}

// Carte d'une tâche à étapes : progression « 2/5 », étape en retard et étape du jour, à cocher
export default function StepSummary({ task, category, now, onCheck }: Props) {
  const steps = stepsOf(task);
  const progress = stepProgress(steps);
  if (!progress) return null;

  const late = lateSteps(steps, now)[0] ?? null;
  const today = todayStep(steps, now);

  const line = (step: TaskStep, text: string, color: string) => (
    <View style={styles.line} key={step.id}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={t.steps.check(step.title)}
        onPress={() => onCheck(step)}
        style={styles.checkArea}
      >
        <View style={[styles.check, { borderColor: color }]} />
      </Pressable>
      <Text style={[styles.lineText, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.progress}
        accessible
        accessibilityLabel={t.steps.progressLabel(progress.done, progress.total)}
      >
        <Ionicons name="list-outline" size={13} color={category.textColor} />
        <Text style={[styles.progressText, { color: category.textColor }]}>
          {t.steps.progress(progress.done, progress.total)}
        </Text>
      </View>
      {late && line(late, t.steps.late(late.title), colors.danger)}
      {today && today.id !== late?.id && line(today, t.steps.today(today.title), colors.text)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    gap: 0,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  progressText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: -12,
  },
  checkArea: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE - 8,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  lineText: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
