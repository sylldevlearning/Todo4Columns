import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReduceMotion } from "../celebration/useReduceMotion";
import { t } from "../i18n";
import { addDays, dayKey, dayStart } from "../dates";
import { dayLabel } from "../format";
import { DEFAULT_STEP_TIME, makeStep, moveStep } from "../steps";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";
import { TaskStep } from "../types";
import IconButton from "./IconButton";
import InfoButton from "./InfoButton";
import OptionPills from "./OptionPills";
import SplitSessions from "./SplitSessions";
import TimeField from "./TimeField";

// Hauteur d'une ligne repliée : sert à calculer la nouvelle place pendant le glissement
export const STEP_ROW_HEIGHT = 52;
// Appui long avant de pouvoir glisser une étape
const DRAG_DELAY_MS = 350;
// Étape cochée : ligne surlignée en vert pendant cette durée
export const STEP_FLASH_MS = 900;

// Choix du jour : Aucun, Aujourd'hui, Demain, Date
const NONE = 0;
const TODAY = 1;
const TOMORROW = 2;
const DATE = 3;
const DAY_OPTIONS = [
  { label: t.steps.dayNone, value: NONE },
  { label: t.steps.dayToday, value: TODAY },
  { label: t.steps.dayTomorrow, value: TOMORROW },
  { label: t.steps.dayDate, value: DATE },
];

interface Colors {
  color: string; // couleur du quadrant
  onColor: string;
  textColor: string;
}

interface Props extends Colors {
  steps: TaskStep[];
  onChange: (steps: TaskStep[]) => void;
  onToggled?: (step: TaskStep, steps: TaskStep[]) => void; // étape cochée ou décochée
}

const dayChoice = (day: string | null, now: number) => {
  if (day === null) return NONE;
  if (day === dayKey(now)) return TODAY;
  if (day === addDays(dayKey(now), 1)) return TOMORROW;
  return DATE;
};

// Jour d'une étape et heure de son rappel
function DayEditor({
  step,
  onChange,
  color,
  onColor,
}: {
  step: TaskStep;
  onChange: (patch: Partial<TaskStep>) => void;
} & Colors) {
  const now = Date.now();
  const today = dayKey(now);
  const pickDate = () => {
    const initial = new Date(dayStart(step.day ?? addDays(today, 2)));
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: initial,
        mode: "date",
        minimumDate: new Date(dayStart(today)),
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange({ day: dayKey(date.getTime()) });
        },
      });
    } else {
      onChange({ day: dayKey(initial.getTime()) });
    }
  };
  const choose = (value: number | null) => {
    if (value === NONE || value === null) onChange({ day: null });
    else if (value === TODAY) onChange({ day: today });
    else if (value === TOMORROW) onChange({ day: addDays(today, 1) });
    else pickDate();
  };

  return (
    <View style={styles.dayEditor}>
      <OptionPills
        options={DAY_OPTIONS}
        value={dayChoice(step.day, now)}
        onChange={choose}
        color={color}
        onColor={onColor}
      />
      {step.day !== null && Platform.OS === "ios" && dayChoice(step.day, now) === DATE && (
        <DateTimePicker
          value={new Date(dayStart(step.day))}
          mode="date"
          display="compact"
          themeVariant="dark"
          accentColor={color}
          locale={t.locale}
          minimumDate={new Date(dayStart(today))}
          onChange={(_, date) => date && onChange({ day: dayKey(date.getTime()) })}
        />
      )}
      {step.day !== null && (
        <TimeField
          label={t.steps.time}
          value={step.time ?? DEFAULT_STEP_TIME}
          onChange={(time) => onChange({ time })}
        />
      )}
    </View>
  );
}

function StepRow({
  step,
  index,
  count,
  expanded,
  onToggle,
  onRename,
  onRemove,
  onMove,
  onExpand,
  onChangeDay,
  reduceMotion,
  ...colorProps
}: {
  reduceMotion: boolean; // « Réduire les animations » : surlignage sans fondu, coche sans rebond
  step: TaskStep;
  index: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onExpand: () => void;
  onChangeDay: (patch: Partial<TaskStep>) => void;
} & Colors) {
  const { color, onColor, textColor } = colorProps;
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);
  const now = Date.now();
  const late = !step.done && step.day !== null && step.day < dayKey(now);

  // Retour visible quand l'étape est cochée : coche animée, ligne brièvement surlignée en vert,
  // vibration légère (la fiche cacherait le message de célébration)
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );
  const toggle = () => {
    if (!step.done) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), STEP_FLASH_MS);
      if (!reduceMotion) {
        checkScale.value = withSequence(
          withTiming(1.35, { duration: 120 }),
          withSpring(1, { damping: 12, stiffness: 260 })
        );
        flashOpacity.value = withSequence(
          withTiming(1, { duration: 120 }),
          withDelay(STEP_FLASH_MS - 520, withTiming(0, { duration: 400 }))
        );
      }
    }
    onToggle();
  };
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  const lift = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  // Appui long puis glisser : la ligne suit le doigt et prend sa nouvelle place au lâcher
  const drag = Gesture.Pan()
    .activateAfterLongPress(DRAG_DELAY_MS)
    .onStart(() => {
      lifted.value = 1;
      scheduleOnRN(lift);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const offset = Math.round(e.translationY / STEP_ROW_HEIGHT);
      if (offset !== 0) scheduleOnRN(onMove, index + offset);
      translateY.value = withSpring(0, { damping: 20, stiffness: 240 });
      lifted.value = 0;
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: lifted.value ? 10 : 0,
    opacity: lifted.value ? 0.9 : 1,
  }));

  const dayText = step.day === null ? t.steps.noDay : dayLabel(step.day, now);

  return (
    <Animated.View style={[styles.step, rowStyle]}>
      {flash && (
        <Animated.View
          pointerEvents="none"
          testID={`step-flash-${index}`}
          style={[styles.flash, !reduceMotion && flashStyle]}
        />
      )}
      <GestureDetector gesture={drag}>
        <View
          style={styles.stepRow}
          accessibilityHint={t.steps.dragHint}
          accessibilityActions={[
            ...(index > 0 ? [{ name: "moveUp", label: t.steps.moveUp }] : []),
            ...(index < count - 1 ? [{ name: "moveDown", label: t.steps.moveDown }] : []),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "moveUp") onMove(index - 1);
            else if (e.nativeEvent.actionName === "moveDown") onMove(index + 1);
          }}
          testID={`step-${index}`}
        >
          <Ionicons name="reorder-two" size={18} color={colors.textMuted} style={styles.handle} />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: step.done }}
            accessibilityLabel={step.done ? t.steps.uncheck(step.title) : t.steps.check(step.title)}
            onPress={toggle}
            style={styles.checkArea}
          >
            <Animated.View
              style={[styles.check, { borderColor: color }, step.done && { backgroundColor: color }, checkStyle]}
            >
              {step.done && <Ionicons name="checkmark" size={14} color={onColor} />}
            </Animated.View>
          </Pressable>
          <TextInput
            style={[styles.stepTitle, step.done && styles.stepTitleDone]}
            value={step.title}
            onChangeText={onRename}
            accessibilityLabel={t.steps.titleLabel(index + 1)}
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.steps.dayOf(step.title, dayText)}
            accessibilityState={{ expanded }}
            onPress={onExpand}
            style={styles.dayButton}
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={late ? colors.danger : step.day ? textColor : colors.textMuted}
            />
            <Text
              style={[styles.dayText, step.day !== null && { color: textColor }, late && styles.late]}
              numberOfLines={1}
            >
              {step.day === null ? "" : dayText}
            </Text>
          </Pressable>
          <IconButton
            icon="close"
            size={18}
            label={t.steps.remove(step.title)}
            color={colors.textMuted}
            onPress={onRemove}
          />
        </View>
      </GestureDetector>
      {expanded && <DayEditor step={step} onChange={onChangeDay} {...colorProps} />}
    </Animated.View>
  );
}

// Section « Étapes » de la fiche : ajouter, renommer, cocher, supprimer, réordonner, jour prévu
export default function StepsEditor({ steps, onChange, onToggled, ...colorProps }: Props) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const reduceMotion = useReduceMotion();

  const update = (id: string, patch: Partial<TaskStep>) =>
    onChange(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const add = () => {
    const title = draft.trim();
    if (title === "") return;
    onChange([...steps, makeStep(title)]);
    setDraft("");
  };

  const toggle = (step: TaskStep) => {
    const next = steps.map((s) =>
      s.id === step.id ? { ...s, done: !s.done, doneAt: s.done ? null : Date.now() } : s
    );
    onChange(next);
    onToggled?.(next.find((s) => s.id === step.id)!, next);
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <StepRow
          key={step.id}
          step={step}
          index={index}
          count={steps.length}
          expanded={expanded === step.id}
          onToggle={() => toggle(step)}
          onRename={(title) => update(step.id, { title })}
          onRemove={() => onChange(steps.filter((s) => s.id !== step.id))}
          onMove={(to) => onChange(moveStep(steps, index, to))}
          onExpand={() => setExpanded(expanded === step.id ? null : step.id)}
          onChangeDay={(patch) => update(step.id, patch)}
          reduceMotion={reduceMotion}
          {...colorProps}
        />
      ))}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={t.steps.addPlaceholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t.steps.addPlaceholder}
          returnKeyType="done"
          onSubmitEditing={add}
          submitBehavior="submit"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.steps.addLabel}
          accessibilityState={{ disabled: draft.trim() === "" }}
          disabled={draft.trim() === ""}
          onPress={add}
          style={({ pressed }) => [
            styles.addButton,
            { borderColor: colorProps.color },
            draft.trim() === "" && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={18} color={colorProps.textColor} />
          <Text style={[styles.addText, { color: colorProps.textColor }]}>{t.steps.add}</Text>
        </Pressable>
      </View>

      <View style={styles.splitRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.steps.split}
          onPress={() => setSplitting(true)}
          style={({ pressed }) => [styles.split, pressed && styles.pressed]}
        >
          <Ionicons name="calendar-number-outline" size={16} color={colorProps.textColor} />
          <Text style={[styles.splitText, { color: colorProps.textColor }]}>{t.steps.split}</Text>
        </Pressable>
        <InfoButton info="splitSessions" />
      </View>

      {splitting && (
        <SplitSessions
          {...colorProps}
          onCancel={() => setSplitting(false)}
          onCreate={(sessions) => {
            onChange([...steps, ...sessions]);
            setSplitting(false);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  step: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  flash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.success, 0.22),
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: STEP_ROW_HEIGHT - 2,
    paddingLeft: 6,
  },
  handle: {
    paddingHorizontal: 2,
  },
  checkArea: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: {
    flex: 1,
    minHeight: TOUCH_SIZE,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  stepTitleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  dayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: TOUCH_SIZE,
    minWidth: TOUCH_SIZE,
    maxWidth: 120,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dayText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  late: {
    color: colors.danger,
  },
  dayEditor: {
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addInput: {
    flex: 1,
    minHeight: TOUCH_SIZE + 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: TOUCH_SIZE + 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  addText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  split: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: TOUCH_SIZE,
    alignSelf: "flex-start",
  },
  splitText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});
