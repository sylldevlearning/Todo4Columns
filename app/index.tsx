import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BalanceCard from "../src/components/BalanceCard";
import Fab from "../src/components/Fab";
import IconButton from "../src/components/IconButton";
import MatrixGrid from "../src/components/MatrixGrid";
import SoonUrgentBanner from "../src/components/SoonUrgentBanner";
import { formatToday } from "../src/format";
import { t, useLanguage } from "../src/i18n";
import { sameItems } from "../src/store/selectableStore";
import { TasksState, useTasksSelector } from "../src/store/TasksContext";
import { colors, fonts } from "../src/theme";

// La matrice n'affiche que les tâches à faire et non archivées
const selectOpenTasks = ({ tasks }: TasksState) =>
  tasks.filter((t) => !t.isDone && t.archivedAt === null);

// Écran d'accueil : la matrice d'Eisenhower
export default function MatrixScreen() {
  useLanguage(); // textes mis à jour quand la langue change
  const tasks = useTasksSelector(selectOpenTasks, sameItems);
  const openCount = tasks.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {t.matrix.title}
          </Text>
          <Text style={styles.summary}>{t.matrix.taskCount(openCount)}</Text>
        </View>
        <IconButton
          icon="calendar-outline"
          label={t.review.open}
          onPress={() => router.push("/review")}
        />
        <IconButton
          icon="settings-outline"
          label={t.common.settings}
          onPress={() => router.push("/settings")}
        />
      </View>

      <View style={styles.balance}>
        <SoonUrgentBanner />
        <BalanceCard />
      </View>

      <View style={styles.grid}>
        <MatrixGrid
          tasks={tasks}
          onOpenQuadrant={(category) => router.push(`/quadrant/${category}`)}
        />
      </View>

      <Fab label={t.matrix.newTask} onPress={() => router.push("/task")} />
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
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  date: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    color: colors.text,
    marginTop: 2,
  },
  summary: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  balance: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  grid: {
    flex: 1,
    paddingHorizontal: 12,
    // Laisse de la place au bouton flottant
    paddingBottom: 96,
  },
});
