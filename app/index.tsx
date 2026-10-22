import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Fab from "../src/components/Fab";
import IconButton from "../src/components/IconButton";
import MatrixGrid from "../src/components/MatrixGrid";
import { formatToday, plural } from "../src/format";
import { useTaskStore } from "../src/store/TasksContext";
import { colors, fonts } from "../src/theme";

// Écran d'accueil : la matrice d'Eisenhower
export default function MatrixScreen() {
  const { tasks } = useTaskStore();
  const openCount = tasks.filter((t) => !t.isDone && t.archivedAt === null).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.title} accessibilityRole="header">
            Ma matrice
          </Text>
          <Text style={styles.summary}>{plural(openCount, "tâche")}</Text>
        </View>
        <IconButton
          icon="settings-outline"
          label="Réglages"
          onPress={() => router.push("/settings")}
        />
      </View>

      <View style={styles.grid}>
        <MatrixGrid
          tasks={tasks}
          onOpenQuadrant={(category) => router.push(`/quadrant/${category}`)}
        />
      </View>

      <Fab label="Nouvelle tâche" onPress={() => router.push("/task")} />
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
  grid: {
    flex: 1,
    paddingHorizontal: 12,
    // Laisse de la place au bouton flottant
    paddingBottom: 96,
  },
});
