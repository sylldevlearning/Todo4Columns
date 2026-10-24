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
      quietHoursEnabled: false,
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
    // (la plage silencieuse reste active pour les réglages enregistrés avant l'option)
    expect(parseSettings(before)).toEqual({ ...DEFAULT_SETTINGS, doNagInterval: 30, quietHoursEnabled: true });
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
    expect(parseSettings(json)).toEqual({ ...DEFAULT_SETTINGS, doNagInterval: 30, quietHoursEnabled: true });
    expect(parseSettings("{pas du json")).toEqual(DEFAULT_SETTINGS);
  });

  it("plage silencieuse : désactivée pour une nouvelle installation", async () => {
    expect(DEFAULT_SETTINGS.quietHoursEnabled).toBe(false);
    expect(parseSettings(null).quietHoursEnabled).toBe(false);
    expect((await loadSettings()).quietHoursEnabled).toBe(false);
  });

  it("plage silencieuse : les réglages déjà enregistrés restent intacts (active, mêmes horaires)", () => {
    const saved = JSON.stringify({
      schemaVersion: 1,
      settings: { ...DEFAULT_SETTINGS, quietHoursEnabled: undefined, quietHoursStart: "23:00", quietHoursEnd: "07:00" },
    });
    expect(parseSettings(saved)).toMatchObject({ quietHoursEnabled: true, quietHoursStart: "23:00", quietHoursEnd: "07:00" });
    const off = JSON.stringify({ schemaVersion: 1, settings: { quietHoursEnabled: false } });
    expect(parseSettings(off).quietHoursEnabled).toBe(false);
  });

  it("plage silencieuse : app déjà installée sans réglages enregistrés, elle reste active", async () => {
    await AsyncStorage.setItem("TASKS_4COLS", JSON.stringify({ schemaVersion: 6, tasks: [] }));
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, quietHoursEnabled: true });
  });

  it("plage silencieuse désactivée : aucun rappel n'est décalé", () => {
    const { computeSchedule } = require("../notifications/schedule");
    const { makeTask } = require("../testing/makeTask");
    const now = new Date(2026, 9, 22, 21).getTime();
    const task = makeTask({ category: "UI", updatedAt: now, nagInterval: 120 }); // 23 h
    expect(computeSchedule(task, DEFAULT_SETTINGS, now)[0].date).toBe(now + 120 * 60 * 1000);
    expect(computeSchedule(task, { ...DEFAULT_SETTINGS, quietHoursEnabled: true }, now)[0].date).toBe(
      new Date(2026, 9, 23, 8).getTime()
    );
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
