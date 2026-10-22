import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { CategoryInfo } from "../constants/categories";
import { SPACING } from "../constants/layout";
import { Task } from "../types";
import TaskItem from "./TaskItem";

interface Props {
  category: CategoryInfo;
  tasks: Task[];
  width: number;
  onToggleDone: (id: string) => void;
  onOpenTimer: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function Column({
  category,
  tasks,
  width,
  onToggleDone,
  onOpenTimer,
  onRemove,
}: Props) {
  return (
    <View style={[styles.column, { width }]}>
      <Text style={styles.columnTitle}>{category.title}</Text>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {tasks.length === 0 && (
          <Text style={styles.emptyText}>Aucune tâche</Text>
        )}
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggleDone={onToggleDone}
            onOpenTimer={onOpenTimer}
            onRemove={onRemove}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    marginHorizontal: SPACING / 4,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 8,
    backgroundColor: "#1F1B24",
    overflow: "hidden",
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: SPACING / 2,
    backgroundColor: "#333333",
    color: "#E5E5E5",
  },
  scrollContent: {
    paddingBottom: SPACING / 2,
  },
  emptyText: {
    textAlign: "center",
    color: "#777777",
    fontStyle: "italic",
    paddingVertical: SPACING,
  },
});
