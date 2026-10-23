import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { anticipated, MIN_FOR_BALANCE, totalOf, weeklyHistory } from "../src/balance";
import { useCelebration } from "../src/celebration/CelebrationProvider";
import BalanceBar from "../src/components/BalanceBar";
import IconButton from "../src/components/IconButton";
import InfoButton from "../src/components/InfoButton";
import { CATEGORY_BY_KEY } from "../src/constants/categories";
import { t } from "../src/i18n";
import { isPriority, MAX_PRIORITIES, priorityTargetWeek, recordReview } from "../src/review";
import { sameItems } from "../src/store/selectableStore";
import { TasksState, useTaskActions, useTasksSelector } from "../src/store/TasksContext";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../src/theme";
import { Category, Task } from "../src/types";

const STEPS = 3;

type SomedayChoice = "keep" | "plan" | "archive";
type DelegatedChoice = "done" | "waiting";

const openIn = (category: Category) => ({ tasks }: TasksState) =>
  tasks.filter((t) => t.category === category && !t.isDone && t.archivedAt === null);
const selectSomeday = openIn("NDNI");
const selectPlanned = openIn("INU");
const selectDelegated = openIn("UDI");
const selectCompleted = ({ tasks }: TasksState) => tasks.filter((t) => t.isDone);

// Choix unique parmi quelques options, pour une tâche
function Choices<T extends string>({
  options,
  value,
  onChange,
  color,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  color: string;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.choice, selected && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TaskRow({ task, children }: { task: Task; children?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowTitle}>{task.title}</Text>
      {children}
    </View>
  );
}

// Revue de la semaine : 3 étapes (« Passer » sur chacune), puis le résumé
export default function ReviewScreen() {
  const actions = useTaskActions();
  const { celebrate } = useCelebration();
  const someday = useTasksSelector(selectSomeday, sameItems);
  const planned = useTasksSelector(selectPlanned, sameItems);
  const delegated = useTasksSelector(selectDelegated, sameItems);
  const completed = useTasksSelector(selectCompleted, sameItems);
  const isLoaded = useTasksSelector(({ isLoaded }) => isLoaded);

  const [step, setStep] = useState(0); // 0 à 2, puis STEPS pour le résumé
  const [somedayChoices, setSomedayChoices] = useState<Record<string, SomedayChoice>>({});
  // Les priorités en cours sont présélectionnées
  const [priorities, setPriorities] = useState<string[]>([]);
  const [delegatedChoices, setDelegatedChoices] = useState<Record<string, DelegatedChoice>>({});
  const [streak, setStreak] = useState<number | null>(null);
  const finished = useRef(false);

  // Revue ouverte depuis une notification, avant la fin du chargement : présélection au chargement
  useEffect(() => {
    if (isLoaded) {
      setPriorities(planned.filter((task) => isPriority(task, Date.now())).map((task) => task.id));
    }
  }, [isLoaded]);

  // Fin de la revue : enregistrée une seule fois, et célébrée comme une tâche « Planifier »
  useEffect(() => {
    if (step !== STEPS || finished.current) return;
    finished.current = true;
    celebrate("INU");
    recordReview(Date.now())
      .then(setStreak)
      .catch((e) => console.warn("Erreur enregistrement revue :", e));
  }, [step]);

  // Applique les choix de l'étape en cours, puis passe à la suivante
  const applyStep = () => {
    if (step === 0) {
      for (const task of someday) {
        const choice = somedayChoices[task.id];
        if (choice === "plan") actions.moveTask(task.id, "INU");
        else if (choice === "archive") actions.archiveTask(task.id);
      }
    } else if (step === 1) {
      actions.setWeekPriorities(priorities, priorityTargetWeek(Date.now()));
    } else if (step === 2) {
      for (const task of delegated) {
        const choice = delegatedChoices[task.id];
        if (choice === "done") actions.completeTask(task.id);
        // La relance de la personne repart de zéro
        else if (choice === "waiting") actions.updateTask(task.id, {});
      }
    }
    setStep(step + 1);
  };

  const togglePriority = (id: string) =>
    setPriorities((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < MAX_PRIORITIES
        ? [...prev, id]
        : prev
    );

  const renderStep = () => {
    if (step === 0) {
      const ndni = CATEGORY_BY_KEY.NDNI;
      return (
        <StepContent title={t.review.someday.title} body={t.review.someday.body} color={ndni.textColor}>
          {someday.length === 0 && <Text style={styles.empty}>{t.review.someday.empty}</Text>}
          {someday.map((task) => (
            <TaskRow key={task.id} task={task}>
              <Choices
                options={[
                  { value: "keep", label: t.review.someday.keep },
                  { value: "plan", label: t.review.someday.plan },
                  { value: "archive", label: t.review.someday.archive },
                ]}
                value={somedayChoices[task.id] ?? "keep"}
                onChange={(choice) => setSomedayChoices((prev) => ({ ...prev, [task.id]: choice }))}
                color={ndni.color}
              />
            </TaskRow>
          ))}
        </StepContent>
      );
    }
    if (step === 1) {
      const plan = CATEGORY_BY_KEY.INU;
      return (
        <StepContent title={t.review.priorities.title} body={t.review.priorities.body} color={plan.textColor}>
          {planned.length === 0 ? (
            <Text style={styles.empty}>{t.review.priorities.empty}</Text>
          ) : (
            <Text style={styles.counter} accessibilityLiveRegion="polite">
              {t.review.priorities.count(priorities.length, MAX_PRIORITIES)}
            </Text>
          )}
          {planned.map((task) => {
            const checked = priorities.includes(task.id);
            const disabled = !checked && priorities.length >= MAX_PRIORITIES;
            return (
              <Pressable
                key={task.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled }}
                accessibilityLabel={task.title}
                disabled={disabled}
                onPress={() => togglePriority(task.id)}
                style={[styles.row, styles.checkRow, disabled && styles.disabled]}
              >
                <Ionicons
                  name={checked ? "star" : "star-outline"}
                  size={22}
                  color={checked ? colors.warning : colors.textMuted}
                />
                <Text style={styles.rowTitle}>{task.title}</Text>
              </Pressable>
            );
          })}
        </StepContent>
      );
    }
    if (step === 2) {
      const delegate = CATEGORY_BY_KEY.UDI;
      return (
        <StepContent title={t.review.delegated.title} body={t.review.delegated.body} color={delegate.textColor}>
          {delegated.length === 0 && <Text style={styles.empty}>{t.review.delegated.empty}</Text>}
          {delegated.map((task) => (
            <TaskRow key={task.id} task={task}>
              {task.delegatedTo && (
                <Text style={styles.rowDetail}>{t.review.delegated.to(task.delegatedTo)}</Text>
              )}
              <Choices
                options={[
                  { value: "done", label: t.review.delegated.done },
                  { value: "waiting", label: t.review.delegated.waiting },
                ]}
                value={delegatedChoices[task.id] ?? null}
                onChange={(choice) => setDelegatedChoices((prev) => ({ ...prev, [task.id]: choice }))}
                color={delegate.color}
              />
            </TaskRow>
          ))}
        </StepContent>
      );
    }

    // Résumé
    const week = weeklyHistory(completed, Date.now(), 0)[0].counts;
    const total = totalOf(week);
    return (
      <View style={styles.end}>
        <Ionicons name="checkmark-circle" size={56} color={CATEGORY_BY_KEY.INU.color} />
        <Text style={styles.endTitle} accessibilityRole="header">
          {t.review.end.title}
        </Text>
        {streak !== null && (
          <Text style={styles.streak} accessibilityLiveRegion="polite">
            {t.review.end.streak(streak)}
          </Text>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.review.end.balance}</Text>
          <BalanceBar counts={week} height={14} />
          <Text style={styles.summary}>
            {total >= MIN_FOR_BALANCE
              ? t.balance.anticipated(anticipated(week), total)
              : t.balance.notEnough}
          </Text>
        </View>
      </View>
    );
  };

  const isEnd = step === STEPS;
  const plan = CATEGORY_BY_KEY.INU;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <IconButton icon="close" label={t.review.close} onPress={() => router.back()} />
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              {t.review.title}
            </Text>
            <InfoButton info="review" />
          </View>
          {!isEnd && <Text style={styles.progress}>{t.review.progress(step + 1, STEPS)}</Text>}
        </View>
        {!isEnd && (
          <Pressable accessibilityRole="button" onPress={() => setStep(step + 1)} style={styles.skip}>
            <Text style={styles.skipText}>{t.review.skip}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>{renderStep()}</ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={isEnd ? () => router.back() : applyStep}
          style={({ pressed }) => [styles.next, { backgroundColor: plan.color }, pressed && styles.pressed]}
        >
          <Text style={[styles.nextText, { color: plan.onColor }]}>
            {isEnd ? t.review.end.back : step === STEPS - 1 ? t.review.finish : t.review.next}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StepContent({
  title,
  body,
  color,
  children,
}: {
  title: string;
  body: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.step}>
      <Text style={[styles.stepTitle, { color }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.stepBody}>{body}</Text>
      <View style={styles.list}>{children}</View>
    </View>
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
    fontSize: 20,
    color: colors.text,
  },
  progress: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  skip: {
    minHeight: TOUCH_SIZE,
    minWidth: TOUCH_SIZE,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textMuted,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  step: {
    gap: 8,
  },
  stepTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
  },
  stepBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  list: {
    marginTop: 12,
    gap: 10,
  },
  empty: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  counter: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TOUCH_SIZE + 12,
  },
  disabled: {
    opacity: 0.45,
  },
  rowTitle: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  rowDetail: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -6,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    minHeight: TOUCH_SIZE,
    paddingHorizontal: 14,
    borderRadius: TOUCH_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  choiceText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  choiceTextSelected: {
    color: colors.bg,
  },
  end: {
    alignItems: "center",
    gap: 12,
    paddingTop: 24,
  },
  endTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    color: colors.text,
  },
  streak: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: CATEGORY_BY_KEY.INU.textColor,
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: withAlpha(CATEGORY_BY_KEY.INU.color, 0.08),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginTop: 12,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  summary: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  next: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
