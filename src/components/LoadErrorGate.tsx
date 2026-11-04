import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { colors, fonts } from "../theme";

const selectLoadError = ({ loadError }: TasksState) => loadError;

// Lecture des tâches impossible : rien n'est enregistré tant qu'elles ne sont pas lues, donc
// les écrans sont remplacés par un message (une tâche saisie ici serait perdue sans le savoir)
export default function LoadErrorGate({ children }: { children: ReactNode }) {
  const loadError = useTasksSelector(selectLoadError);
  const { retryLoad } = useTaskActions();
  if (!loadError) return <>{children}</>;

  const doIt = CATEGORY_BY_KEY.UI;
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={styles.title} accessibilityRole="header">
          {t.loadError.title}
        </Text>
        <Text style={styles.body}>{t.loadError.body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retryLoad}
          style={({ pressed }) => [styles.retry, { backgroundColor: doIt.color }, pressed && styles.pressed]}
        >
          <Text style={[styles.retryText, { color: doIt.onColor }]}>{t.loadError.retry}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: "center",
  },
  retry: {
    minHeight: 54,
    minWidth: 200,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  retryText: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
