import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { anticipated, lastSevenDays, MIN_FOR_BALANCE, totalOf } from "../balance";
import { t } from "../i18n";
import { TasksState, useTasksSelector } from "../store/TasksContext";
import { colors, fonts } from "../theme";
import BalanceBar from "./BalanceBar";
import InfoButton from "./InfoButton";

// Seules les tâches terminées comptent : en ajouter ou en modifier d'autres ne re-rend pas la carte
const selectCompletions = ({ completions }: TasksState) => completions;

// Carte « Ta semaine » de la matrice : équilibre des 7 derniers jours ; un appui ouvre le bilan
export default function BalanceCard() {
  const completed = useTasksSelector(selectCompletions);
  const counts = lastSevenDays(completed, Date.now());
  const total = totalOf(counts);
  const enough = total >= MIN_FOR_BALANCE;
  const summary = enough ? t.balance.anticipated(anticipated(counts), total) : t.balance.notEnough;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.balance.cardTitle}. ${summary}`}
        accessibilityHint={t.balance.open}
        onPress={() => router.push("/balance")}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t.balance.cardTitle}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
        {enough && <BalanceBar counts={counts} height={10} />}
        <Text style={styles.summary}>{summary}</Text>
      </Pressable>
      <InfoButton info="balance" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: 4,
    paddingTop: 12,
  },
  main: {
    flex: 1,
    gap: 8,
    paddingLeft: 14,
    paddingBottom: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  summary: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
  },
});
