import React, { ReactNode, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { CATEGORY_BY_KEY, categoryFromFlags } from "../constants/categories";
import { t } from "../i18n";
import {
  DELEGATE_FOLLOW_UP_OPTIONS,
  DO_NAG_OPTIONS,
  EMPTY_REMINDER_FIELDS,
  hasReminder,
  PLAN_REMINDER_OPTIONS,
} from "../reminders";
import { Settings } from "../settings";
import { isDueSoon } from "../notifications/status";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";
import { Category, ReminderFields, Task } from "../types";
import DueDateField from "./DueDateField";
import InfoButton, { InfoKey } from "./InfoButton";
import OptionPills from "./OptionPills";

export interface TaskFormValues extends ReminderFields {
  title: string;
  category: Category;
}

interface Props {
  task?: Task; // modification
  initialCategory?: Category; // création depuis un quadrant
  settings: Settings;
  notificationsDenied?: boolean; // autorisation refusée : les rappels ne s'afficheront pas
  onOpenSettings?: () => void;
  onSubmit: (values: TaskFormValues) => void;
}

// Création sans quadrant précisé : « Planifier » (important, pas urgent)
const DEFAULT_CATEGORY: Category = "INU";

function Field({ label, info, children }: { label: string; info?: InfoKey; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {info && <InfoButton info={info} />}
      </View>
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  hint,
  info,
  value,
  onChange,
  color,
}: {
  label: string;
  hint?: string;
  info?: InfoKey;
  value: boolean;
  onChange: (value: boolean) => void;
  color: string;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint && <Text style={styles.switchHint}>{hint}</Text>}
      </View>
      {info && <InfoButton info={info} />}
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: color }}
        thumbColor={colors.white}
      />
    </View>
  );
}

// Formulaire de la fiche « Nouvelle tâche » / modification
export default function TaskForm({
  task,
  initialCategory,
  settings,
  notificationsDenied = false,
  onOpenSettings,
  onSubmit,
}: Props) {
  const start = CATEGORY_BY_KEY[task?.category ?? initialCategory ?? DEFAULT_CATEGORY];

  const [title, setTitle] = useState(task?.title ?? "");
  const [urgent, setUrgent] = useState(start.urgent);
  const [important, setImportant] = useState(start.important);
  // Options de chaque quadrant, gardées séparément pour pouvoir changer d'avis
  const [doNag, setDoNag] = useState<number | null>(
    task?.category === "UI" ? task.nagInterval : settings.doNagInterval
  );
  const [doRepeat, setDoRepeat] = useState(
    task?.category === "UI" ? task.nagRepeat : settings.nagRepeat
  );
  const [planDue, setPlanDue] = useState<number | null>(task?.dueAt ?? null);
  const [planReminder, setPlanReminder] = useState<number | null>(
    task?.category === "INU" && task.reminderOffset !== null
      ? task.reminderOffset
      : settings.planReminderOffset
  );
  const [delegateTo, setDelegateTo] = useState(task?.delegatedTo ?? "");
  const [delegateFollowUp, setDelegateFollowUp] = useState<number | null>(
    task?.category === "UDI" && task.nagInterval !== null
      ? task.nagInterval
      : settings.delegateFollowUp
  );

  const category = CATEGORY_BY_KEY[categoryFromFlags(urgent, important)];
  const canSubmit = title.trim() !== "";

  const reminderFields = (): ReminderFields => {
    switch (category.key) {
      case "UI":
        return {
          ...EMPTY_REMINDER_FIELDS,
          nagInterval: doNag,
          nagRepeat: doNag !== null && doRepeat,
        };
      case "INU":
        return { ...EMPTY_REMINDER_FIELDS, dueAt: planDue, reminderOffset: planReminder };
      case "UDI":
        return {
          ...EMPTY_REMINDER_FIELDS,
          delegatedTo: delegateTo.trim() || null,
          nagInterval: delegateFollowUp,
        };
      case "NDNI":
        return { ...EMPTY_REMINDER_FIELDS };
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ title: title.trim(), category: category.key, ...reminderFields() });
  };

  const pillColors = { color: category.color, onColor: category.onColor };

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityRole="header">
        {task ? t.form.editTitle : t.form.newTitle}
      </Text>

      <TextInput
        style={styles.titleInput}
        placeholder={t.form.titlePlaceholder}
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        autoFocus={!task}
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel={t.form.titleLabel}
      />

      <View style={styles.card}>
        <SwitchRow
          label={t.form.urgentQuestion}
          hint={t.form.urgentHint}
          info="urgent"
          value={urgent}
          onChange={setUrgent}
          color={category.color}
        />
        <View style={styles.separator} />
        <SwitchRow
          label={t.form.importantQuestion}
          hint={t.form.importantHint}
          info="important"
          value={important}
          onChange={setImportant}
          color={category.color}
        />
      </View>

      <View
        style={[
          styles.quadrant,
          {
            backgroundColor: withAlpha(category.color, 0.12),
            borderColor: withAlpha(category.color, 0.35),
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.quadrantName, { color: category.textColor }]}>
          → {category.name}
        </Text>
        <Text style={styles.quadrantDescription}>{category.description}</Text>
      </View>

      {category.key === "UI" && (
        <>
          <Field label={t.form.doNag} info="nag">
            <OptionPills options={DO_NAG_OPTIONS} value={doNag} onChange={setDoNag} {...pillColors} />
          </Field>
          {doNag !== null && (
            <View style={styles.card}>
              <SwitchRow
                label={t.form.repeat(settings.maxNags)}
                info="repeat"
                value={doRepeat}
                onChange={setDoRepeat}
                color={category.color}
              />
            </View>
          )}
        </>
      )}

      {category.key === "INU" && (
        <>
          <Field label={t.form.due}>
            <DueDateField value={planDue} onChange={setPlanDue} color={category.textColor} />
          </Field>
          {/* Échéance proche et « C'est urgent ? » sur Non : simple suggestion, rien n'est bloqué */}
          {planDue !== null && isDueSoon(planDue, Date.now()) && (
            <View style={styles.suggestion} accessibilityLiveRegion="polite">
              <Text style={styles.suggestionText}>{t.escalation.suggestion}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUrgent(true)}
                style={styles.suggestionAction}
              >
                <Text style={[styles.suggestionActionText, { color: CATEGORY_BY_KEY.UI.textColor }]}>
                  {t.escalation.suggestionAction}
                </Text>
              </Pressable>
            </View>
          )}
          <Field label={t.form.remindMe} info="reminder">
            <OptionPills
              options={PLAN_REMINDER_OPTIONS}
              value={planReminder}
              onChange={setPlanReminder}
              {...pillColors}
            />
          </Field>
        </>
      )}

      {category.key === "UDI" && (
        <>
          <Field label={t.form.delegatedTo} info="delegatedTo">
            <TextInput
              style={styles.input}
              placeholder={t.form.personPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={delegateTo}
              onChangeText={setDelegateTo}
              accessibilityLabel={t.form.delegatedTo}
            />
          </Field>
          <Field label={t.form.followUp} info="followUp">
            <OptionPills
              options={DELEGATE_FOLLOW_UP_OPTIONS}
              value={delegateFollowUp}
              onChange={setDelegateFollowUp}
              {...pillColors}
            />
          </Field>
        </>
      )}

      {category.key === "NDNI" && (
        <Text style={styles.note}>
          {settings.autoArchive ? t.form.ndniNoteArchive : t.form.ndniNote}
        </Text>
      )}

      {notificationsDenied && hasReminder(category.key, reminderFields()) && (
        <View style={styles.denied}>
          <Text style={styles.deniedText}>{t.form.notificationsDenied}</Text>
          <Pressable accessibilityRole="link" onPress={onOpenSettings} style={styles.deniedLink}>
            <Text style={styles.deniedLinkText}>{t.common.openPhoneSettings}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
        disabled={!canSubmit}
        onPress={submit}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: category.color },
          !canSubmit && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.submitText, { color: category.onColor }]}>
          {task ? t.form.save : t.form.addTo(category.name)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  heading: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    color: colors.text,
  },
  titleInput: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    gap: 12,
  },
  switchText: {
    flex: 1,
    paddingVertical: 10,
  },
  switchLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  switchHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  quadrant: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  quadrantName: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
  },
  quadrantDescription: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  field: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  input: {
    minHeight: TOUCH_SIZE + 4,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  suggestion: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 8,
    marginTop: -8,
  },
  suggestionText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  suggestionAction: {
    minHeight: TOUCH_SIZE,
    justifyContent: "center",
  },
  suggestionActionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  note: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  denied: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  deniedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  deniedLink: {
    minHeight: TOUCH_SIZE,
    justifyContent: "center",
  },
  deniedLinkText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
    textDecorationLine: "underline",
  },
  submit: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitText: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
});
