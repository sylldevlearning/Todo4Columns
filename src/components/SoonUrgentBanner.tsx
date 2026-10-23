import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { formatDue } from "../format";
import { useNow } from "../hooks/useNow";
import { t } from "../i18n";
import { isSoonUrgent } from "../notifications/status";
import { sameItems } from "../store/selectableStore";
import { TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";
import { Task } from "../types";
import InfoButton from "./InfoButton";

const selectPlanned = ({ tasks }: TasksState) =>
  tasks.filter((t) => t.category === "INU" && !t.isDone && t.archivedAt === null);

// Bandeau discret de la matrice : tâches « Planifier » dont l'échéance arrive dans moins de 48 h.
// Un appui les liste, avec « Passer en Faire » pour chacune.
export default function SoonUrgentBanner() {
  const planned = useTasksSelector(selectPlanned, sameItems);
  const now = useNow(60 * 1000);
  const [open, setOpen] = useState(false);
  const soon = planned.filter((t) => isSoonUrgent(t, now)).sort((a, b) => a.dueAt! - b.dueAt!);

  if (soon.length === 0) return null;
  const doIt = CATEGORY_BY_KEY.UI;

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: withAlpha(doIt.color, 0.1), borderColor: withAlpha(doIt.color, 0.3) },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.escalation.banner(soon.length)}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Ionicons name="flame-outline" size={18} color={doIt.textColor} />
        <Text style={[styles.text, { color: doIt.textColor }]}>{t.escalation.banner(soon.length)}</Text>
        <Ionicons name="chevron-forward" size={16} color={doIt.textColor} />
      </Pressable>
      <InfoButton info="soonUrgent" color={doIt.textColor} />
      {open && <SoonUrgentList tasks={soon} onClose={() => setOpen(false)} />}
    </View>
  );
}

function SoonUrgentList({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { moveTask } = useTaskActions();
  const doIt = CATEGORY_BY_KEY.UI;
  const plan = CATEGORY_BY_KEY.INU;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      testID="soon-urgent-list"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t.help.close}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.title} accessibilityRole="header">
          {t.escalation.listTitle}
        </Text>
        <Text style={styles.body}>{t.escalation.listBody}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {tasks.map((task) => (
            <View key={task.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{task.title}</Text>
                <Text style={[styles.rowDue, { color: plan.textColor }]}>{formatDue(task.dueAt!)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t.card.moveToDo} : ${task.title}`}
                onPress={() => moveTask(task.id, "UI")}
                style={({ pressed }) => [
                  styles.move,
                  { backgroundColor: withAlpha(doIt.color, 0.16), borderColor: withAlpha(doIt.color, 0.4) },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.moveText, { color: doIt.textColor }]}>{t.card.moveToDo}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingRight: 2,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: TOUCH_SIZE,
    paddingLeft: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    maxHeight: "75%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 8,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  list: {
    marginTop: 4,
  },
  listContent: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  rowDue: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  move: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  moveText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
