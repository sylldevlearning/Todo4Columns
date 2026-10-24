import AsyncStorage from "@react-native-async-storage/async-storage";

// Réglages des rappels, modifiables dans l'écran Réglages
export const SETTINGS_KEY = "SETTINGS";
export const SETTINGS_SCHEMA_VERSION = 1;

export interface Settings {
  planReminderOffset: number; // rappel des tâches « Planifier » (INU), en minutes avant l'échéance
  doNagInterval: number; // relance des tâches « Faire » (UI) non cochées, en minutes
  delegateFollowUp: number; // relance de la personne pour « Déléguer » (UDI), en minutes
  nagRepeat: boolean; // répéter la relance
  maxNags: number; // nombre maximum de relances
  quietHoursEnabled: boolean; // plage silencieuse activée
  quietHoursStart: string; // début de la plage silencieuse, "HH:MM"
  quietHoursEnd: string; // fin de la plage silencieuse, "HH:MM"
  autoArchive: boolean; // archiver les tâches « Si j'ai le temps » (NDNI) restées 7 jours
  celebrations: boolean; // confettis et message quand une tâche est terminée
  onboardingDone: boolean; // présentation du premier lancement déjà vue
  weeklyReview: boolean; // notification de la revue de la semaine
  weeklyReviewDay: number; // jour de la revue : 0 = dimanche … 6 = samedi
  weeklyReviewTime: string; // heure de la revue, "HH:MM"
  autoEscalate: boolean; // tâches « Planifier » en retard basculées dans « Faire »
}

export const DEFAULT_SETTINGS: Settings = {
  planReminderOffset: 24 * 60, // 1 jour avant
  doNagInterval: 120,
  delegateFollowUp: 24 * 60, // demain
  nagRepeat: false,
  maxNags: 3,
  quietHoursEnabled: false, // nouvelles installations : désactivée
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  autoArchive: false,
  celebrations: true,
  onboardingDone: false,
  weeklyReview: true,
  weeklyReviewDay: 0, // dimanche
  weeklyReviewTime: "18:00",
  autoEscalate: true,
};

// Réglages qui changent les notifications programmées (pas les animations ni l'archivage)
export const notificationSettingsKey = (s: Settings) =>
  JSON.stringify([
    s.planReminderOffset,
    s.doNagInterval,
    s.delegateFollowUp,
    s.nagRepeat,
    s.maxNags,
    s.quietHoursEnabled,
    s.quietHoursStart,
    s.quietHoursEnd,
    s.weeklyReview,
    s.weeklyReviewDay,
    s.weeklyReviewTime,
    s.autoEscalate, // texte de la notification d'échéance
  ]);

export const sameReminderSettings = (a: Settings, b: Settings) =>
  notificationSettingsKey(a) === notificationSettingsKey(b);

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const isPositiveNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

// Garde les valeurs valides et remplace les autres par les valeurs par défaut
export function parseSettings(json: string | null): Settings {
  if (json === null) return { ...DEFAULT_SETTINGS };

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  const raw =
    typeof data === "object" && data !== null && "settings" in data
      ? (data as { settings: unknown }).settings
      : null;
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const s = raw as Record<string, unknown>;

  return {
    planReminderOffset: isNonNegativeNumber(s.planReminderOffset) // 0 = « Le jour J »
      ? s.planReminderOffset
      : DEFAULT_SETTINGS.planReminderOffset,
    doNagInterval: isPositiveNumber(s.doNagInterval)
      ? s.doNagInterval
      : DEFAULT_SETTINGS.doNagInterval,
    delegateFollowUp: isPositiveNumber(s.delegateFollowUp)
      ? s.delegateFollowUp
      : DEFAULT_SETTINGS.delegateFollowUp,
    nagRepeat:
      typeof s.nagRepeat === "boolean" ? s.nagRepeat : DEFAULT_SETTINGS.nagRepeat,
    maxNags:
      isPositiveNumber(s.maxNags) && Number.isInteger(s.maxNags)
        ? s.maxNags
        : DEFAULT_SETTINGS.maxNags,
    // Absent des réglages enregistrés avant l'option : la plage était toujours active, elle le reste
    quietHoursEnabled: typeof s.quietHoursEnabled === "boolean" ? s.quietHoursEnabled : true,
    quietHoursStart:
      typeof s.quietHoursStart === "string" && TIME_PATTERN.test(s.quietHoursStart)
        ? s.quietHoursStart
        : DEFAULT_SETTINGS.quietHoursStart,
    quietHoursEnd:
      typeof s.quietHoursEnd === "string" && TIME_PATTERN.test(s.quietHoursEnd)
        ? s.quietHoursEnd
        : DEFAULT_SETTINGS.quietHoursEnd,
    // Absent des réglages enregistrés avant la 1.1.1 : désactivé
    autoArchive:
      typeof s.autoArchive === "boolean" ? s.autoArchive : DEFAULT_SETTINGS.autoArchive,
    // Absent des réglages enregistrés avant l'option : activé
    celebrations:
      typeof s.celebrations === "boolean" ? s.celebrations : DEFAULT_SETTINGS.celebrations,
    // Absent des réglages enregistrés avant la 1.2 : présentation pas encore vue
    onboardingDone:
      typeof s.onboardingDone === "boolean" ? s.onboardingDone : DEFAULT_SETTINGS.onboardingDone,
    // Absents avant la 1.2 : revue activée le dimanche à 18 h
    weeklyReview:
      typeof s.weeklyReview === "boolean" ? s.weeklyReview : DEFAULT_SETTINGS.weeklyReview,
    weeklyReviewDay:
      Number.isInteger(s.weeklyReviewDay) && (s.weeklyReviewDay as number) >= 0 && (s.weeklyReviewDay as number) <= 6
        ? (s.weeklyReviewDay as number)
        : DEFAULT_SETTINGS.weeklyReviewDay,
    weeklyReviewTime:
      typeof s.weeklyReviewTime === "string" && TIME_PATTERN.test(s.weeklyReviewTime)
        ? s.weeklyReviewTime
        : DEFAULT_SETTINGS.weeklyReviewTime,
    // Absent avant la 1.2 : activé
    autoEscalate:
      typeof s.autoEscalate === "boolean" ? s.autoEscalate : DEFAULT_SETTINGS.autoEscalate,
  };
}

// Tâches enregistrées par une version précédente (clé de storage.ts, à ne pas modifier)
const TASKS_KEY = "TASKS_4COLS";

export async function loadSettings(): Promise<Settings> {
  const json = await AsyncStorage.getItem(SETTINGS_KEY);
  // Aucun réglage enregistré mais l'app était déjà installée (réglages jamais modifiés) : la
  // plage silencieuse s'appliquait déjà, elle reste active. Nouvelle installation : désactivée.
  if (json === null && (await AsyncStorage.getItem(TASKS_KEY)) !== null) {
    return { ...DEFAULT_SETTINGS, quietHoursEnabled: true };
  }
  return parseSettings(json);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings })
  );
}
