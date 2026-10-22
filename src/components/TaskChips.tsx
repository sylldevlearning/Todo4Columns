import React from "react";
import { StyleSheet, View } from "react-native";
import { CategoryInfo } from "../constants/categories";
import { formatDue, formatDuration } from "../format";
import { isWaiting, nextFollowUp } from "../notifications/status";
import { reminderLabel } from "../reminders";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { colors } from "../theme";
import { Task } from "../types";
import Chip from "./Chip";
import { useRemaining } from "./Countdown";

interface Props {
  task: Task;
  category: CategoryInfo;
  compact?: boolean; // grille : minuteur et échéance seulement
  settings?: Settings;
  now?: number;
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

// Puces d'une tâche : minuteur, attente, prochaine relance, échéance, rappel, personne
export default function TaskChips({
  task,
  category,
  compact = false,
  settings = DEFAULT_SETTINGS,
  now = Date.now(),
}: Props) {
  const chipColors = { color: category.color, textColor: category.textColor };
  const chips: React.ReactElement[] = [];

  if (task.timerEnd !== null) {
    chips.push(<TimerChip key="timer" endTs={task.timerEnd} category={category} />);
  }

  if (!compact) {
    if (isWaiting(task, now)) {
      chips.push(
        <Chip
          key="waiting"
          icon="hourglass-outline"
          label={`En attente depuis ${formatDuration(now - task.updatedAt)}`}
          color={colors.warning}
          textColor={colors.warning}
        />
      );
    }
    const next = task.category === "INU" ? null : nextFollowUp(task, settings, now);
    if (next) {
      chips.push(
        <Chip
          key="next"
          icon="notifications-outline"
          label={`Relance dans ${formatDuration(next.date - now, "up")}`}
          {...chipColors}
        />
      );
      if (next.type === "nag" && next.nagTotal! > 1) {
        chips.push(
          <Chip
            key="count"
            icon="repeat"
            label={`Relance ${next.nagIndex}/${next.nagTotal}`}
            {...chipColors}
          />
        );
      }
    }
  }

  if (task.dueAt !== null) {
    chips.push(
      <Chip key="due" icon="calendar-outline" label={formatDue(task.dueAt)} {...chipColors} />
    );
  }

  if (!compact) {
    const reminder = task.category === "INU" ? reminderLabel(task) : null;
    if (reminder) {
      chips.push(
        <Chip key="reminder" icon="notifications-outline" label={reminder} {...chipColors} />
      );
    }
    if (task.delegatedTo !== null) {
      chips.push(
        <Chip key="person" icon="person-outline" label={task.delegatedTo} {...chipColors} />
      );
    }
  }

  if (chips.length === 0) return null;
  return <View style={styles.row}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
});
