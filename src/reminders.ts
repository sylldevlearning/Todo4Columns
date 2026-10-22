import { Settings } from "./settings";
import { Category, ReminderFields, Task } from "./types";

export interface ReminderOption {
  label: string;
  value: number | null; // minutes
}

const DAY = 24 * 60;

// Mode développement uniquement : délai d'une minute pour tester relances et rappels.
// __DEV__ vaut false dans un build de production : l'option n'y apparaît pas.
const withDevOption = (options: ReminderOption[], label = "1 min"): ReminderOption[] =>
  __DEV__ ? [{ label, value: 1 }, ...options] : options;

// Faire : relancer si pas faite après…
export const DO_NAG_OPTIONS: ReminderOption[] = withDevOption([
  { label: "30 min", value: 30 },
  { label: "2 h", value: 120 },
  { label: "1 jour", value: DAY },
  { label: "Jamais", value: null },
]);

// Planifier : me rappeler… (minutes avant l'échéance)
export const PLAN_REMINDER_OPTIONS: ReminderOption[] = withDevOption(
  [
    { label: "Le jour J", value: 0 },
    { label: "1 h avant", value: 60 },
    { label: "La veille", value: DAY },
  ],
  "1 min avant"
);

// Déléguer : relancer la personne…
export const DELEGATE_FOLLOW_UP_OPTIONS: ReminderOption[] = withDevOption([
  { label: "Demain", value: DAY },
  { label: "Dans 3 jours", value: 3 * DAY },
  { label: "1 semaine", value: 7 * DAY },
]);

export const EMPTY_REMINDER_FIELDS: ReminderFields = {
  dueAt: null,
  reminderOffset: null,
  nagInterval: null,
  nagRepeat: false,
  delegatedTo: null,
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
      };
    case "INU":
      return {
        ...EMPTY_REMINDER_FIELDS,
        dueAt: fields.dueAt,
        reminderOffset: fields.reminderOffset,
      };
    case "UDI":
      return {
        ...EMPTY_REMINDER_FIELDS,
        nagInterval: fields.nagInterval,
        delegatedTo: fields.delegatedTo?.trim() || null,
      };
    case "NDNI":
      return { ...EMPTY_REMINDER_FIELDS };
  }
}

// Vrai si ces réglages donneront lieu à un rappel (hors minuteur)
export function hasReminder(category: Category, fields: ReminderFields): boolean {
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
  const { dueAt, reminderOffset, nagInterval, nagRepeat, delegatedTo } = task;
  return { dueAt, reminderOffset, nagInterval, nagRepeat, delegatedTo };
}

// « 30 min », « 2 h », « 3 j »
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < DAY) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / DAY)} j`;
}

const optionLabel = (options: ReminderOption[], value: number) =>
  options.find((o) => o.value === value)?.label ?? durationLabel(value);

// Libellé court du rappel enregistré, ou null s'il n'y en a pas
export function reminderLabel(task: Task): string | null {
  switch (task.category) {
    case "UI":
      if (task.nagInterval === null) return null;
      return `Relance ${optionLabel(DO_NAG_OPTIONS, task.nagInterval)}${
        task.nagRepeat ? " · répétée" : ""
      }`;
    case "INU":
      if (task.dueAt === null || task.reminderOffset === null) return null;
      return optionLabel(PLAN_REMINDER_OPTIONS, task.reminderOffset);
    case "UDI":
      if (task.nagInterval === null) return null;
      return `Relance ${optionLabel(
        DELEGATE_FOLLOW_UP_OPTIONS,
        task.nagInterval
      ).toLowerCase()}`;
    case "NDNI":
      return null;
  }
}
