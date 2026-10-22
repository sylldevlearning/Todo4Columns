import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { isPastDue, isWaiting } from "../notifications/status";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";
import { Task } from "../types";

interface Props {
  task: Task;
  now: number;
  onSnooze: (id: string) => void; // « Reporter 1 h »
  onMove: (id: string) => void; // « Déplacer… » : ouvre le menu
  onMoveToDo: (id: string) => void; // « Passer en Faire »
}

function ActionButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: withAlpha(color, 0.16), borderColor: withAlpha(color, 0.4) },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Boutons d'une tâche qui demande une décision : Faire en attente, Planifier à échéance passée
export default function TaskAlerts({ task, now, onSnooze, onMove, onMoveToDo }: Props) {
  if (isWaiting(task, now)) {
    return (
      <View style={styles.row}>
        <ActionButton label="Reporter 1 h" color={colors.warning} onPress={() => onSnooze(task.id)} />
        <ActionButton label="Déplacer…" color={colors.text} onPress={() => onMove(task.id)} />
      </View>
    );
  }
  if (isPastDue(task, now)) {
    const doIt = CATEGORY_BY_KEY.UI;
    return (
      <View style={styles.row}>
        <ActionButton label="Passer en Faire" color={doIt.textColor} onPress={() => onMoveToDo(task.id)} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  button: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.75,
  },
});
