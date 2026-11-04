import { t, translated } from "./i18n";
import { Settings } from "./settings";
import { Category, ReminderFields, Task, TaskStep } from "./types";

export interface ReminderOption {
  label: string;
  value: number | null; // minutes
}

const DAY = 24 * 60;

// Mode développement uniquement : délai d'une minute pour tester relances et rappels.
// __DEV__ vaut false dans un build de production : l'option n'y apparaît pas.
const withDevOption = (
  options: ReminderOption[],
  label = () => t.reminders.min(1)
): ReminderOption[] => (__DEV__ ? [translated(label, 1), ...options] : options);

// Faire : relancer si pas faite après…
export const DO_NAG_OPTIONS: ReminderOption[] = withDevOption([
  translated(() => t.reminders.min(30), 30),
  translated(() => t.reminders.hours(2), 120),
  translated(() => t.reminders.oneDay, DAY),
  translated(() => t.reminders.never, null),
]);

// Planifier : me rappeler… (minutes avant l'échéance)
export const PLAN_REMINDER_OPTIONS: ReminderOption[] = withDevOption(
  [
    translated(() => t.reminders.onTheDay, 0),
    translated(() => t.reminders.oneHourBefore, 60),
    translated(() => t.reminders.dayBefore, DAY),
  ],
  () => t.reminders.oneMinuteBefore
);

// Déléguer : relancer la personne…
export const DELEGATE_FOLLOW_UP_OPTIONS: ReminderOption[] = withDevOption([
  translated(() => t.reminders.tomorrow, DAY),
  translated(() => t.reminders.inThreeDays, 3 * DAY),
  translated(() => t.reminders.oneWeek, 7 * DAY),
]);

export const EMPTY_REMINDER_FIELDS: ReminderFields = {
  dueAt: null,
  reminderOffset: null,
  nagInterval: null,
  nagRepeat: false,
  delegatedTo: null,
  recurrence: null,
};

// Valeurs proposées par défaut pour une nouvelle tâche du quadrant
export function defaultReminderFields(
  category: Category,
  settings: Settings
): ReminderFields {
  switch (category) {
    case "UI":
      return {
        ...EMPTY_REMINDER_FIELDS,
        nagInterval: settings.doNagInterval,
        nagRepeat: settings.nagRepeat,
      };
    case "INU":
      return { ...EMPTY_REMINDER_FIELDS, reminderOffset: settings.planReminderOffset };
    case "UDI":
      return { ...EMPTY_REMINDER_FIELDS, nagInterval: settings.delegateFollowUp };
    case "NDNI":
      return { ...EMPTY_REMINDER_FIELDS };
  }
}

// Ne garde que les réglages qui ont un sens dans le quadrant
export function keepRelevantFields(
  category: Category,
  fields: ReminderFields
): ReminderFields {
  switch (category) {
    case "UI":
      return {
        ...EMPTY_REMINDER_FIELDS,
        nagInterval: fields.nagInterval,
        nagRepeat: fields.nagInterval !== null && fields.nagRepeat,
        // Passée en Faire, une tâche garde son échéance (puce « En retard »). Récurrente, elle
        // garde aussi sa répétition et son rappel pour l'occurrence suivante (dans « Planifier »)
        dueAt: fields.dueAt,
        ...(fields.recurrence && fields.dueAt !== null
          ? { recurrence: fields.recurrence, reminderOffset: fields.reminderOffset }
          : {}),
      };
    case "INU":
      return {
        ...EMPTY_REMINDER_FIELDS,
        dueAt: fields.dueAt,
        reminderOffset: fields.reminderOffset,
        // Une tâche récurrente a forcément une échéance
        recurrence: fields.dueAt !== null ? fields.recurrence : null,
      };
    case "UDI":
      return {
        ...EMPTY_REMINDER_FIELDS,
        nagInterval: fields.nagInterval,
        delegatedTo: fields.delegatedTo?.trim() || null,
        // Facultative : reprise dans le message envoyé à la personne (« avant le … »)
        dueAt: fields.dueAt,
      };
    case "NDNI":
      return { ...EMPTY_REMINDER_FIELDS };
  }
}

// Vrai si ces réglages donneront lieu à un rappel (hors minuteur)
// Rappel enregistré : celui du quadrant, ou une étape non faite avec un jour prévu
export function hasReminder(category: Category, fields: ReminderFields, steps: TaskStep[] = []): boolean {
  if (steps.some((s) => !s.done && s.day !== null)) return true;
  switch (category) {
    case "UI":
    case "UDI":
      return fields.nagInterval !== null;
    case "INU":
      return fields.dueAt !== null;
    case "NDNI":
      return false;
  }
}

export function pickReminderFields(task: ReminderFields): ReminderFields {
  const { dueAt, reminderOffset, nagInterval, nagRepeat, delegatedTo, recurrence } = task;
  return { dueAt, reminderOffset, nagInterval, nagRepeat, delegatedTo, recurrence };
}

// « 30 min », « 2 h », « 3 j » (« 3 d » en anglais)
export function durationLabel(minutes: number): string {
  if (minutes < 60) return t.reminders.min(minutes);
  if (minutes < DAY) return t.reminders.hours(Math.round(minutes / 60));
  return t.reminders.days(Math.round(minutes / DAY));
}

const optionLabel = (options: ReminderOption[], value: number) =>
  options.find((o) => o.value === value)?.label ?? durationLabel(value);

// Libellé court du rappel enregistré, ou null s'il n'y en a pas
export function reminderLabel(task: Task): string | null {
  switch (task.category) {
    case "UI":
      if (task.nagInterval === null) return null;
      return t.reminders.nagLabel(optionLabel(DO_NAG_OPTIONS, task.nagInterval), task.nagRepeat);
    case "INU":
      if (task.dueAt === null || task.reminderOffset === null) return null;
      return optionLabel(PLAN_REMINDER_OPTIONS, task.reminderOffset);
    case "UDI":
      if (task.nagInterval === null) return null;
      return t.reminders.followUpLabel(
        optionLabel(DELEGATE_FOLLOW_UP_OPTIONS, task.nagInterval)
      );
    case "NDNI":
      return null;
  }
}
