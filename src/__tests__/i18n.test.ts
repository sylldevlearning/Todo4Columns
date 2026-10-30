import { getLocales } from "expo-localization";
import { currentLanguage, detectLanguage, LANGUAGES, t, TRANSLATIONS } from "../i18n";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import { fr } from "../i18n/fr";
import { ko } from "../i18n/ko";
import { ja } from "../i18n/ja";
import { id } from "../i18n/id";
import { itIT } from "../i18n/it";
import { de } from "../i18n/de";
import { ptBR } from "../i18n/pt-BR";

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
    [["sv", "fr"], "en"], // seule la langue préférée compte
    [["es"], "es"],
    [["pt"], "pt-BR"],
    [["de"], "de"],
    [["it"], "it"],
    [["id"], "id"],
    [["in"], "id"],
    [["ja"], "ja"],
    [["ko"], "ko"],
    [["sv"], "en"],
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
    expect([es.matrix.taskCount(1), es.matrix.taskCount(2)]).toEqual(["1 tarea", "2 tareas"]);
    expect([ptBR.matrix.taskCount(1), ptBR.matrix.taskCount(2)]).toEqual(["1 tarefa", "2 tarefas"]);
    expect([de.matrix.taskCount(1), de.matrix.taskCount(2)]).toEqual(["1 Aufgabe", "2 Aufgaben"]);
    expect([itIT.balance.done(1), itIT.balance.done(2)]).toEqual(["1 attività completata", "2 attività completate"]);
    expect([id.matrix.taskCount(1), id.matrix.taskCount(3)]).toEqual(["1 tugas", "3 tugas"]);
    expect([ja.matrix.taskCount(1), ja.matrix.taskCount(3)]).toEqual(["1件のタスク", "3件のタスク"]);
    expect([ko.matrix.taskCount(1), ko.matrix.taskCount(3)]).toEqual(["할 일 1개", "할 일 3개"]);
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
