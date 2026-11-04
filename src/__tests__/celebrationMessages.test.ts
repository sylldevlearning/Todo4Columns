import { createMessagePicker, pickIndex } from "../celebration/messages";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { Category } from "../types";

const CATEGORIES: Category[] = ["UI", "INU", "UDI", "NDNI"];

describe("messages de célébration", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("%s : 10 messages différents et non vides par quadrant", (_, translations) => {
    for (const category of CATEGORIES) {
      const list = translations.celebrations[category];
      expect(list).toHaveLength(10);
      expect(new Set(list).size).toBe(10);
      for (const message of list) expect(message.trim()).not.toBe("");
    }
  });

  it("reprend les textes français demandés", () => {
    expect(fr.celebrations.UI[0]).toBe("Et une urgence de moins !");
    expect(fr.celebrations.INU[5]).toBe("Ton futur toi te remercie.");
    expect(fr.celebrations.UDI[9]).toBe("Bien joué, chef d'orchestre.");
    expect(fr.celebrations.NDNI[9]).toBe("Coché, sans pression.");
  });
});

describe("pickIndex", () => {
  it("ne renvoie jamais l'index précédent", () => {
    for (let previous = 0; previous < 10; previous++) {
      for (const r of [0, 0.1, 0.5, 0.89, 0.99999]) {
        const index = pickIndex(10, previous, () => r);
        expect(index).not.toBe(previous);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(10);
      }
    }
  });

  it("peut atteindre tous les autres index", () => {
    const reached = new Set(
      Array.from({ length: 9 }, (_, i) => pickIndex(10, 4, () => (i + 0.5) / 9))
    );
    expect([...reached].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9]);
  });

  it("gère les listes d'un seul message et l'absence de tirage précédent", () => {
    expect(pickIndex(1, 0)).toBe(0);
    expect(pickIndex(10, null, () => 0.95)).toBe(9);
  });
});

describe("createMessagePicker", () => {
  it("ne répète jamais deux fois de suite le même message dans un quadrant", () => {
    const pick = createMessagePicker(fr.celebrations);
    for (const category of CATEGORIES) {
      let previous = "";
      for (let i = 0; i < 500; i++) {
        const message = pick(category);
        expect(fr.celebrations[category]).toContain(message);
        expect(message).not.toBe(previous);
        previous = message;
      }
    }
  });

  it("garde un historique séparé par quadrant", () => {
    // Avec un hasard constant, deux quadrants différents peuvent donner le même index
    const pick = createMessagePicker(fr.celebrations, () => 0);
    expect(pick("UI")).toBe(fr.celebrations.UI[0]);
    expect(pick("INU")).toBe(fr.celebrations.INU[0]);
    expect(pick("UI")).toBe(fr.celebrations.UI[1]);
  });
});
