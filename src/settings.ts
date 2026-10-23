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
  quietHoursStart: string; // début de la plage silencieuse, "HH:MM"
  quietHoursEnd: string; // fin de la plage silencieuse, "HH:MM"
  autoArchive: boolean; // archiver les tâches « Si j'ai le temps » (NDNI) restées 7 jours
  celebrations: boolean; // confettis et message quand une tâche est terminée
}

export const DEFAULT_SETTINGS: Settings = {
  planReminderOffset: 24 * 60, // 1 jour avant
  doNagInterval: 120,
  delegateFollowUp: 24 * 60, // demain
  nagRepeat: false,
  maxNags: 3,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  autoArchive: false,
  celebrations: true,
};

// Réglages qui changent les notifications programmées (pas les animations ni l'archivage)
export const notificationSettingsKey = (s: Settings) =>
  JSON.stringify([
    s.planReminderOffset,
    s.doNagInterval,
    s.delegateFollowUp,
    s.nagRepeat,
    s.maxNags,
    s.quietHoursStart,
    s.quietHoursEnd,
  ]);

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
  };
}

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await AsyncStorage.getItem(SETTINGS_KEY));
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, settings })
  );
}
