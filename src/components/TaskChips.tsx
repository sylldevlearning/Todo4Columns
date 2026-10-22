import React from "react";
import { StyleSheet, View } from "react-native";
import { CategoryInfo } from "../constants/categories";
import { formatDue } from "../format";
import { reminderLabel } from "../reminders";
import { Task } from "../types";
import Chip from "./Chip";
import { useRemaining } from "./Countdown";

interface Props {
  task: Task;
  category: CategoryInfo;
  compact?: boolean; // grille : minuteur et échéance seulement
}

function TimerChip({ endTs, category }: { endTs: number; category: CategoryInfo }) {
  const remaining = useRemaining(endTs);
  return (
    <Chip
      icon="timer-outline"
      label={remaining}
      color={category.color}
      textColor={category.textColor}
    />
  );
}

// Puces d'une tâche : minuteur restant, échéance, rappel, personne
export default function TaskChips({ task, category, compact = false }: Props) {
  const reminder = compact ? null : reminderLabel(task);
  const hasChips =
    task.timerEnd !== null ||
    task.dueAt !== null ||
    reminder !== null ||
    (!compact && task.delegatedTo !== null);
  if (!hasChips) return null;

  return (
    <View style={styles.row}>
      {task.timerEnd !== null && (
        <TimerChip endTs={task.timerEnd} category={category} />
      )}
      {task.dueAt !== null && (
        <Chip
          icon="calendar-outline"
          label={formatDue(task.dueAt)}
          color={category.color}
          textColor={category.textColor}
        />
      )}
      {reminder !== null && (
        <Chip
          icon="notifications-outline"
          label={reminder}
          color={category.color}
          textColor={category.textColor}
        />
      )}
      {!compact && task.delegatedTo !== null && (
        <Chip
          icon="person-outline"
          label={task.delegatedTo}
          color={category.color}
          textColor={category.textColor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
});
