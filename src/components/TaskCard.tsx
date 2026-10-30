import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CategoryInfo } from "../constants/categories";
import { t, useLanguage } from "../i18n";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { isWaiting } from "../notifications/status";
import { isPriority } from "../review";
import { Settings } from "../settings";
import { useTaskActions } from "../store/TasksContext";
import { Task } from "../types";
import TaskAlerts from "./TaskAlerts";
import IconButton from "./IconButton";
import StepSummary from "./StepSummary";
import TaskChips from "./TaskChips";

// Distance de glissement qui déclenche l'action
const SWIPE_THRESHOLD = 96;

interface Props {
  task: Task;
  category: CategoryInfo;
  // Cercle à cocher et glissement vers la droite ; anchor situe la carte pour la célébration
  onToggleDone: (id: string, anchor?: View | null) => void;
  onDelete: (id: string) => void; // glissement vers la gauche
  onPress: (id: string) => void; // ouvre la modification
  onOpenMenu: (id: string) => void;
  onSnooze: (id: string) => void; // « Reporter 1 h » d'une tâche en attente
  onMoveToDo: (id: string) => void; // « Passer en Faire » à échéance passée
  onCheckStep: (taskId: string, stepId: string) => void; // étape du jour ou en retard cochée
  settings: Settings; // réglages des rappels (puces)
  now: number;
}

// Carte de tâche : glisser à droite pour terminer, à gauche pour supprimer.
// Mémoïsée : ne se re-rend que si sa tâche, les réglages ou l'heure affichée changent.
export default React.memo(function TaskCard({
  task,
  category,
  onToggleDone,
  onDelete,
  onPress,
  onOpenMenu,
  onSnooze,
  onMoveToDo,
  onCheckStep,
  settings,
  now,
}: Props) {
  useLanguage(); // carte mémoïsée : re-rendue quand la langue change
  const translateX = useSharedValue(0);
  const waiting = isWaiting(task, now);
  const wrapperRef = useRef<View>(null);
  const { getSettings } = useTaskActions();

  const toggle = () => onToggleDone(task.id, wrapperRef.current);
  const complete = () => {
    // Une tâche terminée avec célébration a déjà son retour haptique
    if (task.isDone || !getSettings().celebrations) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    toggle();
  };
  const remove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete(task.id);
  };

  const pan = Gesture.Pan()
    // Glissement horizontal uniquement : le défilement vertical reste possible
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) scheduleOnRN(complete);
      else if (e.translationX < -SWIPE_THRESHOLD) scheduleOnRN(remove);
      translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const doneBackground = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? 1 : 0,
  }));
  const deleteBackground = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
  }));

  const priority = isPriority(task, now);
  const checkLabel = task.isDone ? t.card.markTodo(task.title) : t.card.markDone(task.title);
  const completeLabel = task.isDone ? t.card.reopen : t.card.complete;

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <Animated.View style={[styles.action, styles.doneAction, doneBackground]}>
        <Ionicons name={task.isDone ? "arrow-undo" : "checkmark"} size={22} color={colors.white} />
        <Text style={styles.actionText}>{completeLabel}</Text>
      </Animated.View>
      <Animated.View style={[styles.action, styles.deleteAction, deleteBackground]}>
        <Text style={styles.actionText}>{t.common.delete}</Text>
        <Ionicons name="trash-outline" size={22} color={colors.white} />
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              priority ? `${t.card.edit(task.title)}, ${t.review.priority}` : t.card.edit(task.title)
            }
            accessibilityActions={[
              { name: "activate" },
              { name: "complete", label: completeLabel },
              { name: "delete", label: t.common.delete },
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === "complete") toggle();
              else if (e.nativeEvent.actionName === "delete") onDelete(task.id);
              else onPress(task.id);
            }}
            onPress={() => onPress(task.id)}
            style={[styles.card, waiting && styles.cardWaiting]}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.isDone }}
              accessibilityLabel={checkLabel}
              onPress={toggle}
              style={styles.checkArea}
            >
              <View
                style={[
                  styles.circle,
                  { borderColor: category.color },
                  task.isDone && { backgroundColor: category.color },
                ]}
              >
                {task.isDone && (
                  <Ionicons name="checkmark" size={16} color={category.onColor} />
                )}
              </View>
            </Pressable>

            <View style={styles.body}>
              <View style={styles.titleRow}>
                {priority && <Ionicons name="star" size={14} color={colors.warning} />}
                <Text
                  style={[styles.title, task.isDone && styles.titleDone]}
                  numberOfLines={3}
                >
                  {task.title}
                </Text>
              </View>
              {!task.isDone && (
                <>
                  <TaskChips task={task} category={category} settings={settings} now={now} />
                  <StepSummary
                    task={task}
                    category={category}
                    now={now}
                    onCheck={(step) => onCheckStep(task.id, step.id)}
                  />
                  <TaskAlerts
                    task={task}
                    now={now}
                    onSnooze={onSnooze}
                    onMove={onOpenMenu}
                    onMoveToDo={onMoveToDo}
                  />
                </>
              )}
            </View>

            <IconButton
              icon="ellipsis-horizontal"
              label={t.card.options(task.title)}
              color={colors.textMuted}
              onPress={() => onOpenMenu(task.id)}
            />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  action: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  doneAction: {
    backgroundColor: colors.success,
    justifyContent: "flex-start",
  },
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "flex-end",
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    paddingVertical: 8,
    paddingRight: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  cardWaiting: {
    borderColor: colors.warning,
    borderWidth: 1.5,
  },
  checkArea: {
    width: TOUCH_SIZE + 8,
    height: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingVertical: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  titleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
});
