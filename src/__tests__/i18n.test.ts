import { getLocales } from "expo-localization";
import { currentLanguage, detectLanguage, LANGUAGES, t, TRANSLATIONS } from "../i18n";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";

const mockedGetLocales = getLocales as jest.Mock;
const locales = (...codes: string[]) => codes.map((languageCode) => ({ languageCode }));

// Forme d'un objet de traductions : clés, types, longueur des listes et nombre de paramètres
function shape(value: unknown): unknown {
  if (typeof value === "function") return `function(${value.length})`;
  if (typeof value !== "object" || value === null) return typeof value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, shape(v)])
  );
}

describe("detectLanguage", () => {
  afterEach(() => mockedGetLocales.mockReset().mockReturnValue(locales("fr")));

  it.each([
    [["fr"], "fr"],
    [["fr", "en"], "fr"],
    [["en"], "en"],
    [["de", "fr"], "en"], // seule la langue préférée compte
    [["es"], "en"],
    [[], "en"],
  ])("langues %j → %s", (codes, expected) => {
    mockedGetLocales.mockReturnValue(locales(...codes));
    expect(detectLanguage()).toBe(expected);
  });

  it("anglais si la langue ne peut pas être lue", () => {
    mockedGetLocales.mockImplementation(() => {
      throw new Error("indisponible");
    });
    expect(detectLanguage()).toBe("en");
  });
});

describe("fichiers de traduction", () => {
  it.each(LANGUAGES.filter((l) => l !== "fr"))("%s a exactement les clés de fr.ts", (language) => {
    expect(shape(TRANSLATIONS[language])).toEqual(shape(fr));
  });

  it.each(LANGUAGES)("%s : aucun texte vide", (language) => {
    const strings = (o: unknown): string[] =>
      typeof o === "string" ? [o] : typeof o === "object" && o ? Object.values(o).flatMap(strings) : [];
    for (const text of strings(TRANSLATIONS[language])) expect(text.trim()).not.toBe("");
  });

  it("pluriels", () => {
    expect([fr.matrix.taskCount(0), fr.matrix.taskCount(1), fr.matrix.taskCount(2)]).toEqual([
      "0 tâche",
      "1 tâche",
      "2 tâches",
    ]);
    expect([en.matrix.taskCount(0), en.matrix.taskCount(1), en.matrix.taskCount(2)]).toEqual([
      "0 tasks",
      "1 task",
      "2 tasks",
    ]);
    expect(en.undo.deleted(3)).toBe("3 tasks deleted");
  });
});

describe("téléphone en français (par défaut dans les tests)", () => {
  it("utilise le français", () => {
    expect(currentLanguage()).toBe("fr");
    expect(t).toEqual(fr);
  });

  it("nomme les quadrants Faire / Planifier / Déléguer / Si j'ai le temps", () => {
    const { CATEGORIES } = require("../constants/categories");
    expect(CATEGORIES.map((c: { name: string }) => c.name)).toEqual([
      "Faire",
      "Planifier",
      "Déléguer",
      "Si j'ai le temps",
    ]);
  });
});

describe("notifications en français", () => {
  it("canal « Rappels » et boutons Fait / Reporter 1 h / Ouvrir", async () => {
    const Notifications = require("expo-notifications");
    const { Platform } = require("react-native");
    Platform.OS = "android";
    await require("../notifications/setup").configureNotifications();
    expect(Notifications.__state.channels.reminders.name).toBe("Rappels");
    expect(
      Notifications.__state.categories["task-reminder"].map((a: { buttonTitle: string }) => a.buttonTitle)
    ).toEqual(["Fait", "Reporter 1 h", "Ouvrir"]);
  });
});
