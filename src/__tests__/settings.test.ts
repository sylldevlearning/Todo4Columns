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
      nagRepeat: false,
      maxNags: 3,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
    });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
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
