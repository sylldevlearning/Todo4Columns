import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORIES } from "../constants/categories";
import { colors, fonts } from "../theme";
import { Category, Task } from "../types";

interface Props {
  task: Task | null; // null = menu fermé
  onClose: () => void;
  onMove: (id: string, category: Category) => void;
  onTimer: (id: string) => void;
}

// Menu « … » d'une tâche : déplacer vers un autre quadrant, minuteur
export default function TaskMenu({ task, onClose, onMove, onTimer }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={task !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer le menu"
      />
      {task && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {task.title}
          </Text>

          <Text style={styles.section}>Déplacer vers…</Text>
          {CATEGORIES.filter((c) => c.key !== task.category).map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`Déplacer vers ${c.name}`}
              onPress={() => onMove(task.id, c.key)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: c.textColor }]}>{c.name}</Text>
                <Text style={styles.rowSubtitle}>{c.subtitle}</Text>
              </View>
            </Pressable>
          ))}

          <View style={styles.separator} />
          <Pressable
            accessibilityRole="button"
            onPress={() => onTimer(task.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="timer-outline" size={20} color={colors.text} />
            <Text style={styles.rowTitle}>Minuteur</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
            <Text style={[styles.rowTitle, { color: colors.textMuted }]}>Annuler</Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  taskTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    color: colors.text,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  section: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  pressed: {
    backgroundColor: colors.surfaceRaised,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  rowSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
});
