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
      <Text style={[styles.columnTitle, { borderBottomColor: category.color }]}>
        {category.title}
      </Text>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
    borderBottomWidth: 3,
  },
  scrollContent: {
    paddingBottom: SPACING / 2,
  },
});
