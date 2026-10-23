import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_KEY,
} from "../settings";

describe("settings", () => {
  beforeEach(() => AsyncStorage.clear());

  it("a les valeurs par défaut attendues", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      planReminderOffset: 1440,
      doNagInterval: 120,
      delegateFollowUp: 1440,
      nagRepeat: false,
      maxNags: 3,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      autoArchive: false,
      celebrations: true,
      onboardingDone: false,
      weeklyReview: true,
      weeklyReviewDay: 0,
      weeklyReviewTime: "18:00",
      autoEscalate: true,
    });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("animations de célébration : activées pour les réglages enregistrés avant l'option", () => {
    const before = JSON.stringify({ schemaVersion: 1, settings: { autoArchive: true } });
    expect(parseSettings(before).celebrations).toBe(true);
    const disabled = JSON.stringify({ schemaVersion: 1, settings: { celebrations: false } });
    expect(parseSettings(disabled).celebrations).toBe(false);
  });

  it("présentation : pas encore vue pour les réglages enregistrés avant la 1.2", () => {
    const before = JSON.stringify({ schemaVersion: 1, settings: { doNagInterval: 30 } });
    expect(parseSettings(before)).toEqual({ ...DEFAULT_SETTINGS, doNagInterval: 30 });
    expect(parseSettings(before).onboardingDone).toBe(false);
    const done = JSON.stringify({ schemaVersion: 1, settings: { onboardingDone: true } });
    expect(parseSettings(done).onboardingDone).toBe(true);
    const invalid = JSON.stringify({ schemaVersion: 1, settings: { onboardingDone: "oui" } });
    expect(parseSettings(invalid).onboardingDone).toBe(false);
  });

  it("archivage automatique : désactivé pour les réglages enregistrés avant l'option", () => {
    const before = JSON.stringify({ schemaVersion: 1, settings: { doNagInterval: 30 } });
    expect(parseSettings(before).autoArchive).toBe(false);
    const enabled = JSON.stringify({ schemaVersion: 1, settings: { autoArchive: true } });
    expect(parseSettings(enabled).autoArchive).toBe(true);
    const invalid = JSON.stringify({ schemaVersion: 1, settings: { autoArchive: "oui" } });
    expect(parseSettings(invalid).autoArchive).toBe(false);
  });

  it("accepte « Le jour J » (0 min) pour Planifier", () => {
    const json = JSON.stringify({ schemaVersion: 1, settings: { planReminderOffset: 0 } });
    expect(parseSettings(json).planReminderOffset).toBe(0);
  });

  it("remplace les valeurs invalides par les valeurs par défaut", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      settings: { doNagInterval: 30, maxNags: -1, quietHoursStart: "25:00" },
    });
    expect(parseSettings(json)).toEqual({ ...DEFAULT_SETTINGS, doNagInterval: 30 });
    expect(parseSettings("{pas du json")).toEqual(DEFAULT_SETTINGS);
  });

  it("enregistre sous la clé SETTINGS et relit les réglages", async () => {
    const custom = { ...DEFAULT_SETTINGS, nagRepeat: true, maxNags: 5 };
    await saveSettings(custom);

    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!)).toEqual({
      schemaVersion: 1,
      settings: custom,
    });
    expect(await loadSettings()).toEqual(custom);
  });
});
