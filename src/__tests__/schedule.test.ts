import { computeSchedule, shiftOutOfQuietHours } from "../notifications/schedule";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { makeTask } from "../testing/makeTask";

const MIN = 60 * 1000;
// Dates en heure locale : mercredi 22 octobre 2026
const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime();
const NOW = at(10);
const NO_QUIET: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00" };

describe("shiftOutOfQuietHours (22:00 → 08:00)", () => {
  const shift = (ts: number) => shiftOutOfQuietHours(ts, "22:00", "08:00");

  it("laisse les heures hors plage", () => {
    expect(shift(at(21, 59))).toBe(at(21, 59));
    expect(shift(at(8))).toBe(at(8));
  });

  it("décale le soir à 8 h le lendemain", () => {
    expect(shift(at(22))).toBe(at(8, 0, 23));
    expect(shift(at(23, 30))).toBe(at(8, 0, 23));
  });

  it("décale la nuit à 8 h le jour même", () => {
    expect(shift(at(0, 15))).toBe(at(8));
    expect(shift(at(7, 59))).toBe(at(8));
  });

  it("gère une plage dans la journée et l'absence de plage", () => {
    expect(shiftOutOfQuietHours(at(13), "12:00", "14:00")).toBe(at(14));
    expect(shiftOutOfQuietHours(at(11), "12:00", "14:00")).toBe(at(11));
    expect(shiftOutOfQuietHours(at(23), "00:00", "00:00")).toBe(at(23));
  });
});

describe("computeSchedule", () => {
  describe("Faire", () => {
    const base = makeTask({ category: "UI", title: "Appeler", updatedAt: at(9), nagInterval: 120 });

    it("programme une relance à updatedAt + délai", () => {
      const items = computeSchedule(base, NO_QUIET, NOW);
      expect(items).toEqual([
        {
          date: at(11),
          type: "nag",
          content: { title: "Appeler", body: "Toujours pas faite ?" },
          nagIndex: 1,
          nagTotal: 1,
        },
      ]);
    });

    it("répète au même intervalle jusqu'au maximum des réglages", () => {
      const items = computeSchedule({ ...base, nagRepeat: true }, NO_QUIET, NOW);
      expect(items.map((i) => i.date)).toEqual([at(11), at(13), at(15)]);
      expect(items.map((i) => i.content.body)).toEqual([
        "Toujours pas faite ? Relance 1/3",
        "Toujours pas faite ? Relance 2/3",
        "Toujours pas faite ? Relance 3/3",
      ]);

      const five = computeSchedule({ ...base, nagRepeat: true }, { ...NO_QUIET, maxNags: 5 }, NOW);
      expect(five).toHaveLength(5);
    });

    it("ignore les relances déjà passées", () => {
      const items = computeSchedule({ ...base, nagRepeat: true }, NO_QUIET, at(12));
      expect(items.map((i) => i.nagIndex)).toEqual([2, 3]);
    });

    it("n'a aucune relance si le délai est « Jamais »", () => {
      expect(computeSchedule({ ...base, nagInterval: null }, NO_QUIET, NOW)).toEqual([]);
    });

    it("« Reporter 1 h » déplace la prochaine relance sans compter dans le maximum", () => {
      // Relance 1 envoyée à 11 h, report demandé à 11 h 10
      const snoozed = { ...base, nagRepeat: true, snoozedUntil: at(12, 10) };
      const items = computeSchedule(snoozed, NO_QUIET, at(11, 10));

      expect(items.map((i) => [i.type, i.nagIndex])).toEqual([
        ["snooze", undefined],
        ["nag", 2],
        ["nag", 3],
      ]);
      expect(items.map((i) => i.date)).toEqual([at(12, 10), at(14, 10), at(16, 10)]);
    });

    it("reporte même quand la seule relance a déjà été envoyée", () => {
      const items = computeSchedule({ ...base, snoozedUntil: at(12, 10) }, NO_QUIET, at(11, 10));
      expect(items.map((i) => i.type)).toEqual(["snooze"]);
    });
  });

  describe("Planifier", () => {
    const base = makeTask({
      category: "INU",
      title: "Rapport",
      dueAt: at(18, 0, 24),
      reminderOffset: 24 * 60,
    });

    it("rappelle avant l'échéance puis à l'échéance", () => {
      const items = computeSchedule(base, NO_QUIET, NOW);
      expect(items.map((i) => [i.type, i.date])).toEqual([
        ["reminder", at(18, 0, 23)],
        ["due", at(18, 0, 24)],
      ]);
      expect(items[1].content.body).toBe("Échéance atteinte, passer en Faire ?");
      expect(items[0].content.body).toMatch(/^Échéance : Sam\. 24 oct\. · 18:00$/);
    });

    it("ne double pas la notification pour « Le jour J »", () => {
      const items = computeSchedule({ ...base, reminderOffset: 0 }, NO_QUIET, NOW);
      expect(items.map((i) => i.type)).toEqual(["due"]);
    });

    it("n'a rien sans échéance", () => {
      expect(computeSchedule({ ...base, dueAt: null }, NO_QUIET, NOW)).toEqual([]);
    });

    it("ignore le rappel passé mais garde l'échéance à venir", () => {
      const items = computeSchedule(base, NO_QUIET, at(19, 0, 23));
      expect(items.map((i) => i.type)).toEqual(["due"]);
    });
  });

  describe("Déléguer", () => {
    it("relance à la date choisie en nommant la personne", () => {
      const task = makeTask({
        category: "UDI",
        updatedAt: at(9),
        nagInterval: 24 * 60,
        delegatedTo: "Marie",
      });
      expect(computeSchedule(task, NO_QUIET, NOW)).toEqual([
        {
          date: at(9, 0, 23),
          type: "delegate",
          content: { title: "Tâche", body: "As-tu des nouvelles de Marie ?" },
        },
      ]);
    });
  });

  describe("Minuteur et Si j'ai le temps", () => {
    it("notifie à la fin du minuteur", () => {
      const task = makeTask({ category: "INU", timerEnd: at(10, 25) });
      expect(computeSchedule(task, NO_QUIET, NOW)).toEqual([
        { date: at(10, 25), type: "timer", content: { title: "Tâche", body: "Minuteur terminé" } },
      ]);
    });

    it("n'a aucune notification pour Si j'ai le temps, même avec un minuteur", () => {
      const task = makeTask({ category: "NDNI", timerEnd: at(10, 25), nagInterval: 30 });
      expect(computeSchedule(task, NO_QUIET, NOW)).toEqual([]);
    });
  });

  describe("règles communes", () => {
    const task = makeTask({ category: "UI", updatedAt: at(20), nagInterval: 180, nagRepeat: true });

    it("décale les relances tombant en plage silencieuse à sa fin", () => {
      const items = computeSchedule(task, DEFAULT_SETTINGS, NOW);
      // 23 h, 2 h, 5 h -> toutes décalées au lendemain 8 h
      expect(items.map((i) => i.date)).toEqual([at(8, 0, 23), at(8, 0, 23), at(8, 0, 23)]);
    });

    it("ne décale jamais un minuteur, même en plage silencieuse", () => {
      const timer = makeTask({ category: "UI", timerEnd: at(23, 15) });
      expect(computeSchedule(timer, DEFAULT_SETTINGS, NOW).map((i) => [i.type, i.date])).toEqual([
        ["timer", at(23, 15)],
      ]);
    });

    it("ignore une date passée même après décalage", () => {
      const lateTimer = makeTask({ category: "UI", timerEnd: at(9, 30) });
      expect(computeSchedule(lateTimer, NO_QUIET, NOW)).toEqual([]);
    });

    it("n'a aucune notification pour une tâche terminée ou archivée", () => {
      expect(computeSchedule({ ...task, isDone: true }, NO_QUIET, NOW)).toEqual([]);
      expect(computeSchedule({ ...task, archivedAt: NOW }, NO_QUIET, NOW)).toEqual([]);
    });
  });
});
