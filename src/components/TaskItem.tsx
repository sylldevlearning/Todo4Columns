import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SPACING } from "../constants/layout";
import { Task } from "../types";
import Countdown from "./Countdown";

interface Props {
  task: Task;
  onToggleDone: (id: string) => void;
  onOpenTimer: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function TaskItem({
  task,
  onToggleDone,
  onOpenTimer,
  onRemove,
}: Props) {
  return (
    <View style={styles.taskItem}>
      <TouchableOpacity
        onPress={() => onToggleDone(task.id)}
        style={styles.checkbox}
      >
        <Text style={styles.checkboxEmoji}>{task.isDone ? "✅" : "⬜️"}</Text>
      </TouchableOpacity>
      <View style={styles.textAndTimer}>
        <Text style={[styles.taskText, task.isDone && styles.taskTextDone]}>
          {task.title}
        </Text>
        {task.timerEnd !== null && <Countdown endTs={task.timerEnd} />}
      </View>
      <View style={styles.iconsRight}>
        <TouchableOpacity onPress={() => onOpenTimer(task.id)}>
          <Text style={styles.timerIcon}>⏱️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onRemove(task.id)}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING / 1.5,
    paddingVertical: SPACING / 3,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  checkbox: {
    marginRight: SPACING / 2,
  },
  checkboxEmoji: {
    fontSize: 22,
    color: "#E5E5E5",
  },
  textAndTimer: {
    flex: 1,
    flexDirection: "column",
  },
  taskText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E5E5E5",
  },
  taskTextDone: {
    textDecorationLine: "line-through",
    color: "#777777",
    fontStyle: "italic",
  },
  iconsRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: SPACING / 2,
  },
  timerIcon: {
    fontSize: 20,
    color: "#BB86FC",
    marginRight: SPACING / 2,
  },
  deleteText: {
    fontSize: 18,
    color: "#CF6679",
  },
});
