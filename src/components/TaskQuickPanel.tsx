import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryInfo } from "../constants/categories";
import { t } from "../i18n";
import { noteUndo } from "../reviewPrompt";
import { isAutoProgress, PROGRESS_VALUES, taskProgress } from "../progress";
import { stepsOf } from "../steps";
import { colors, fonts, TOUCH_SIZE, withAlpha, themedStyles } from "../theme";
import { Task } from "../types";
import InfoButton from "./InfoButton";
import ProgressBar from "./ProgressBar";

interface Props {
  task: Task | null; // null : panneau fermé
  category: CategoryInfo;
  onToggleStep: (taskId: string, stepId: string) => void; // coche ou décoche en un geste
  onSetProgress: (taskId: string, percent: number) => void; // sans étapes : réglage à la main
  onClose: () => void;
  undo?: { message: string; onUndo: () => void } | null; // « Annuler » visible dans le panneau
}

// Panneau rapide ouvert par un appui long sur une carte : avancement en pourcentage et étapes à
// cocher, sans ouvrir la fiche
export default function TaskQuickPanel({ task, category, onToggleStep, onSetProgress, onClose, undo }: Props) {
  const insets = useSafeAreaInsets();
  if (!task) return null;
  const steps = stepsOf(task);
  const percent = taskProgress(task) ?? 0;
  const auto = isAutoProgress(task);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.progress.close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal testID="quick-panel">
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {task.title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.progress.close} onPress={onClose} style={styles.close}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.label}>{t.progress.label}</Text>
          <InfoButton info="progress" />
          <Text style={[styles.percent, { color: category.textColor }]} accessibilityLiveRegion="polite">
            {t.progress.value(percent)}
          </Text>
        </View>
        <ProgressBar percent={percent} color={category.color} height={8} />
        <Text style={styles.hint}>{auto ? t.progress.auto : t.progress.manual}</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {auto ? (
            <>
              <Text style={styles.section}>{t.progress.steps}</Text>
              {steps.map((step) => (
                <Pressable
                  key={step.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: step.done }}
                  accessibilityLabel={step.title}
                  onPress={() => onToggleStep(task.id, step.id)}
                  style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                >
                  <View
                    style={[styles.box, { borderColor: category.color }, step.done && { backgroundColor: category.color }]}
                  >
                    {step.done && <Ionicons name="checkmark" size={16} color={category.onColor} />}
                  </View>
                  <Text style={[styles.stepTitle, step.done && styles.stepDone]}>{step.title}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <View style={styles.values} accessibilityRole="radiogroup">
              {PROGRESS_VALUES.map((value) => {
                const selected = (task.progress ?? 0) === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t.progress.value(value)}
                    onPress={() => onSetProgress(task.id, value)}
                    style={[
                      styles.value,
                      selected && { backgroundColor: category.color, borderColor: category.color },
                    ]}
                  >
                    <Text style={[styles.valueText, selected && { color: category.onColor }]}>{t.progress.value(value)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {undo && (
          <View style={styles.undo} accessibilityLiveRegion="polite">
            <Text style={styles.undoText} numberOfLines={2}>
              {undo.message}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.undo.action} onPress={() => {
                // Pas de demande d'avis juste après un « Annuler »
                noteUndo();
                undo.onUndo();
              }} style={styles.undoAction}>
              <Text style={styles.undoActionText}>{t.undo.action}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
    },
    sheet: {
      maxHeight: "80%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 16,
      paddingHorizontal: 20,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      flex: 1,
      fontFamily: fonts.extrabold,
      fontSize: 19,
      color: colors.text,
    },
    close: {
      width: TOUCH_SIZE,
      height: TOUCH_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    label: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.text,
    },
    percent: {
      marginLeft: "auto",
      fontFamily: fonts.extrabold,
      fontSize: 20,
    },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    scroll: {
      flexGrow: 0,
    },
    content: {
      gap: 4,
      paddingVertical: 4,
    },
    section: {
      fontFamily: fonts.bold,
      fontSize: 13,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.textMuted,
      marginBottom: 4,
    },
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: TOUCH_SIZE,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    stepTitle: {
      flex: 1,
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: colors.text,
    },
    stepDone: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
    values: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    value: {
      minWidth: 58,
      minHeight: TOUCH_SIZE,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    valueText: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.text,
    },
    undo: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: withAlpha(colors.overlay, 0.06),
    },
    undoText: {
      flex: 1,
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.text,
    },
    undoAction: {
      minHeight: TOUCH_SIZE,
      paddingHorizontal: 12,
      justifyContent: "center",
    },
    undoActionText: {
      fontFamily: fonts.extrabold,
      fontSize: 14,
      color: colors.text,
    },
    pressed: {
      opacity: 0.6,
    },
  })
);
