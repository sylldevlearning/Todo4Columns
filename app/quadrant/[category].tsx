import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useCelebration } from "../../src/celebration/CelebrationProvider";
import { SafeAreaView } from "react-native-safe-area-context";
import Fab from "../../src/components/Fab";
import IconButton from "../../src/components/IconButton";
import InfoButton from "../../src/components/InfoButton";
import TaskCard from "../../src/components/TaskCard";
import TaskMenu from "../../src/components/TaskMenu";
import TimerModal from "../../src/components/TimerModal";
import UndoBanner from "../../src/components/UndoBanner";
import { CATEGORY_BY_KEY, isCategory } from "../../src/constants/categories";
import { offerToFinishAfterStep } from "../../src/finishPrompt";
import { useNow } from "../../src/hooks/useNow";
import { useStableCallback } from "../../src/hooks/useStableCallback";
import { RemovedTask } from "../../src/hooks/useTasks";
import { t } from "../../src/i18n";
import { pickReminderFields } from "../../src/reminders";
import { sameReminderSettings, Settings } from "../../src/settings";
import { stepsOf } from "../../src/steps";
import { sameItems } from "../../src/store/selectableStore";
import {
  useSettingsSelector,
  useTaskActions,
  useTasksSelector,
} from "../../src/store/TasksContext";
import { colors, fonts, TOUCH_SIZE } from "../../src/theme";
import { Task } from "../../src/types";

const UNDO_DELAY_MS = 5000;

interface Undo {
  message: string;
  run: () => void;
}

// Lignes de la liste : tâches à faire (ou message vide), puis section « Terminées »
type Row =
  | { kind: "task"; task: Task }
  | { kind: "empty" }
  | { kind: "doneHeader" };

const rowKey = (row: Row) => (row.kind === "task" ? row.task.id : row.kind);

const Separator = () => <View style={styles.separator} />;

const allSettings = (settings: Settings) => settings;

// Liste des tâches d'un quadrant
export default function QuadrantScreen() {
  const { category: param } = useLocalSearchParams<{ category: string }>();
  const key = isCategory(param) ? param : null;
  const store = useTaskActions();
  // Tâches de ce quadrant seulement : une modification ailleurs ne re-rend pas cet écran
  const tasks = useTasksSelector(
    ({ tasks }) => tasks.filter((t) => t.category === key && t.archivedAt === null),
    sameItems
  );
  // Les cartes n'utilisent que les réglages des rappels : les autres ne les re-rendent pas
  const settings = useSettingsSelector(allSettings, sameReminderSettings);
  const celebration = useCelebration();
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const now = useNow();
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimeout.current) clearTimeout(undoTimeout.current);
    },
    []
  );

  // Bandeau « Annuler » visible 5 s ; une nouvelle action remplace la précédente
  const offerUndo = (message: string, run: () => void) => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    setUndo({ message, run });
    undoTimeout.current = setTimeout(() => setUndo(null), UNDO_DELAY_MS);
  };

  const restoreLater = (removed: RemovedTask[]) => () => store.restoreTasks(removed);

  // Actions des cartes : identité fixe pour que seules les cartes modifiées se re-rendent
  const handleToggle = useStableCallback((id: string, anchor?: View | null) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    store.toggleDone(id);
    // Célébration seulement quand la tâche passe à « terminée » ; « Annuler » la fait disparaître
    const celebrationId = task.isDone ? null : celebration.celebrate(task.category, anchor);
    offerUndo(task.isDone ? t.undo.reopened : t.undo.completed, () => {
      if (celebrationId !== null) celebration.dismiss(celebrationId);
      store.toggleDone(id);
    });
  });

  // Étape cochée depuis la carte : petite célébration et « Annuler ». La dernière propose de
  // terminer la tâche, avec la célébration complète et « Annuler », comme la coche de la tâche.
  const handleCheckStep = useStableCallback((taskId: string, stepId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || stepsOf(task).every((s) => s.id !== stepId || s.done)) return;
    store.toggleStep(taskId, stepId);
    const stepCelebration = celebration.celebrateStep(task.category);
    offerUndo(t.undo.stepDone, () => {
      if (stepCelebration !== null) celebration.dismiss(stepCelebration);
      store.toggleStep(taskId, stepId);
    });
    offerToFinishAfterStep(stepsOf(task), stepId, () => {
      store.completeTask(taskId);
      const celebrationId = celebration.celebrate(task.category);
      offerUndo(t.undo.completed, () => {
        if (celebrationId !== null) celebration.dismiss(celebrationId);
        store.toggleDone(taskId);
      });
    });
  });

  const handleDelete = useStableCallback((id: string) => {
    offerUndo(t.undo.deleted(1), restoreLater(store.removeTask(id)));
  });

  const openEdit = useStableCallback((id: string) =>
    router.push({ pathname: "/task", params: { id } })
  );

  const handleSnooze = useStableCallback((id: string) => {
    const previous = tasks.find((t) => t.id === id)?.snoozedUntil ?? null;
    store.snoozeTask(id);
    store.requestNotificationPermission().catch(() => {});
    offerUndo(t.undo.snoozed, () => store.setSnoozedUntil(id, previous));
  });

  const handleMoveToDo = useStableCallback((id: string) => {
    const before = tasks.find((t) => t.id === id);
    store.moveTask(id, "UI");
    if (before) {
      offerUndo(t.undo.movedToDo, () =>
        store.updateTask(id, { category: before.category, ...pickReminderFields(before) })
      );
    }
  });

  if (!isCategory(param)) return <Redirect href="/" />;
  const category = CATEGORY_BY_KEY[param];

  const openTasks = tasks.filter((t) => !t.isDone);
  const doneTasks = tasks.filter((t) => t.isDone);
  const menuTask = tasks.find((t) => t.id === menuTaskId) ?? null;

  const handleClearDone = () => {
    const removed = store.clearDone(category.key);
    if (removed.length > 0) {
      offerUndo(t.undo.deleted(removed.length), restoreLater(removed));
    }
  };

  const cardProps = {
    category,
    onToggleDone: handleToggle,
    onDelete: handleDelete,
    onPress: openEdit,
    onOpenMenu: setMenuTaskId,
    onSnooze: handleSnooze,
    onMoveToDo: handleMoveToDo,
    onCheckStep: handleCheckStep,
    settings,
    now,
  };

  const rows: Row[] = [
    ...(openTasks.length === 0
      ? [{ kind: "empty" } as const]
      : openTasks.map((task) => ({ kind: "task", task }) as const)),
    ...(doneTasks.length > 0 ? [{ kind: "doneHeader" } as const] : []),
    ...(showDone ? doneTasks.map((task) => ({ kind: "task", task }) as const) : []),
  ];

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "task") return <TaskCard task={item.task} {...cardProps} />;
    if (item.kind === "empty") return <Text style={styles.empty}>{t.quadrant.empty}</Text>;
    return (
      <View style={styles.doneHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showDone }}
          onPress={() => setShowDone((v) => !v)}
          style={styles.doneToggle}
        >
          <Text style={styles.doneTitle}>{t.quadrant.done(doneTasks.length)}</Text>
          <Ionicons
            name={showDone ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={handleClearDone} style={styles.clearButton}>
          <Text style={styles.clearText}>{t.quadrant.clearDone}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" label={t.common.back} onPress={() => router.back()} />
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { color: category.textColor }]}
              accessibilityRole="header"
            >
              {category.name}
            </Text>
            <InfoButton info={category.key} />
          </View>
          <Text style={styles.subtitle}>
            {t.quadrant.subtitle(category.axisLabel, openTasks.length)}
          </Text>
        </View>
      </View>

      {/* Liste virtualisée : seules les cartes proches de l'écran sont rendues */}
      <FlatList
        data={rows}
        keyExtractor={rowKey}
        renderItem={renderRow}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        // Le découpage natif des vues hors écran peut faire disparaître des cartes animées
        removeClippedSubviews={false}
      />

      {undo && (
        <UndoBanner
          message={undo.message}
          onUndo={() => {
            undo.run();
            setUndo(null);
          }}
        />
      )}

      <Fab
        label={t.quadrant.newTaskIn(category.name)}
        color={category.color}
        iconColor={category.onColor}
        onPress={() =>
          router.push({ pathname: "/task", params: { category: category.key } })
        }
      />

      <TaskMenu
        task={menuTask}
        onClose={() => setMenuTaskId(null)}
        onMove={(id, target) => {
          const before = tasks.find((t) => t.id === id);
          setMenuTaskId(null);
          store.moveTask(id, target);
          if (before) {
            // L'annulation remet aussi les rappels tels qu'ils étaient
            offerUndo(t.undo.movedTo(CATEGORY_BY_KEY[target].name), () =>
              store.updateTask(id, {
                category: before.category,
                ...pickReminderFields(before),
              })
            );
          }
        }}
        onTimer={(id) => {
          setMenuTaskId(null);
          setTimerTaskId(id);
        }}
      />

      <TimerModal
        visible={timerTaskId !== null}
        color={category.color}
        onColor={category.onColor}
        onCancel={() => setTimerTaskId(null)}
        onValidate={(minutes) => {
          if (timerTaskId) {
            store.startTimer(timerTaskId, minutes);
            store.requestNotificationPermission().catch(() => {});
          }
          setTimerTaskId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 180, // place pour le bandeau et le bouton flottant
  },
  separator: {
    height: 10,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 32,
  },
  doneHeader: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doneToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: TOUCH_SIZE,
    paddingRight: 8,
  },
  doneTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textMuted,
  },
  clearButton: {
    minHeight: TOUCH_SIZE,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  clearText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.danger,
  },
});
