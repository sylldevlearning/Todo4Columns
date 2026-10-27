import { WEEK_KEY_PATTERN } from "../balance";
import { addDays, DAY_PATTERN, dayKey, hhmm, isDayKey, isTime, pad, TIME_PATTERN } from "../dates";
import { parseSettings } from "../settings";

describe("module de dates commun", () => {
  it("jours, heures et zéros de tête au même endroit", () => {
    expect(pad(7)).toBe("07");
    expect(hhmm(new Date(2026, 9, 22, 9, 5).getTime())).toBe("09:05");
    expect(dayKey(new Date(2026, 0, 3, 23, 59).getTime())).toBe("2026-01-03");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isTime("24:00")).toBe(false);
    expect(isTime("23:59")).toBe(true);
  });

  it("bilan et réglages utilisent les mêmes motifs", () => {
    expect(WEEK_KEY_PATTERN).toBe(DAY_PATTERN);
    // Heure invalide dans les réglages : valeur par défaut, comme le motif commun le veut
    expect(TIME_PATTERN.test("7:30")).toBe(false);
    expect(parseSettings(JSON.stringify({ schemaVersion: 1, settings: { quietHoursStart: "7:30" } })).quietHoursStart).toBe(
      "22:00"
    );
  });
});

describe("modules des étapes", () => {
  it("steps.ts ne dépend pas des textes", () => {
    jest.isolateModules(() => {
      jest.doMock("../i18n", () => {
        throw new Error("textes chargés");
      });
      expect(() => require("../steps")).not.toThrow();
    });
    jest.dontMock("../i18n");
  });

  it("la répartition est dans son propre module", () => {
    const sessions = require("../sessions");
    expect(typeof sessions.splitSessions).toBe("function");
    expect(require("../steps").splitSessions).toBeUndefined();
  });
});
