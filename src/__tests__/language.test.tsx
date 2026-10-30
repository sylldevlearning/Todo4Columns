import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import * as Notifications from "expo-notifications";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Platform } from "react-native";
import RootLayout from "../../app/_layout";
import MatrixScreen from "../../app/index";
import SettingsScreen from "../../app/settings";
import { CATEGORIES } from "../constants/categories";
import { DO_NAG_OPTIONS } from "../reminders";
import {
  currentLanguage,
  detectLanguage,
  LANGUAGE_NAMES,
  LANGUAGES,
  languageFor,
  setLanguagePreference,
  t,
  TRANSLATIONS,
} from "../i18n";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { serializeTasks } from "../migrations";
import { SETTINGS_KEY } from "../settings";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const mockedGetLocales = getLocales as jest.Mock;
const mock = Notifications as unknown as {
  __state: {
    scheduled: { content: { title: string; body: string } }[];
    channels: Record<string, { name: string }>;
    categories: Record<string, { buttonTitle: string }[]>;
  };
};

// Rendu avec le router : plus lent que les autres tests
jest.setTimeout(30000);

afterEach(() => {
  mockedGetLocales.mockReset().mockReturnValue([{ languageCode: "fr", languageTag: "fr-FR" }]);
  setLanguagePreference("auto");
});

describe("langue automatique", () => {
  it.each([
    [{ languageCode: "fr", languageTag: "fr-CA" }, "fr"],
    [{ languageCode: "en", languageTag: "en-GB" }, "en"],
    [{ languageCode: "sv", languageTag: "sv-SE" }, "en"], // langue absente : anglais
    [{ languageCode: null, languageTag: "fr-FR" }, "fr"],
    [{ languageCode: null, languageTag: "" }, "en"],
  ])("%j → %s", (locale, expected) => {
    expect(languageFor(locale)).toBe(expected);
  });

  it("suit la langue du téléphone, anglais si elle est absente", () => {
    mockedGetLocales.mockReturnValue([{ languageCode: "sv", languageTag: "sv-SE" }]);
    setLanguagePreference("auto");
    expect(currentLanguage()).toBe("en");
    expect(t.settings.title).toBe("Settings");
  });

  it("chaque langue a son nom natif et ses traductions", () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_NAMES[language]).toBeTruthy();
      expect(TRANSLATIONS[language]).toBeDefined();
    }
  });
});

describe("langue choisie", () => {
  it("remplace les textes sans changer d'objet, puis revient à la langue du téléphone", () => {
    const before = t;
    setLanguagePreference("en");
    expect(t).toBe(before);
    expect(t.settings.title).toBe(en.settings.title);
    expect(CATEGORIES[0].name).toBe("Do");
    expect(DO_NAG_OPTIONS.find((o) => o.value === 120)?.label).toBe("2 h");
    expect(DO_NAG_OPTIONS.find((o) => o.value === null)?.label).toBe("Never");
    setLanguagePreference("auto");
    expect(currentLanguage()).toBe(detectLanguage());
    expect(t.settings.title).toBe(fr.settings.title);
    expect(CATEGORIES[0].name).toBe("Faire");
  });
});

describe("réglage « Langue » dans l'app", () => {
  const task = () => makeTask({ id: "a", title: "Appeler le client", category: "UI" });
  // Notification programmée : rappel de la revue de la semaine (dimanche 18 h par défaut)
  const bodies = () => mock.__state.scheduled.map((n) => n.content.body);

  const openApp = async (settings: Record<string, unknown> = {}) => {
    Platform.OS = "android";
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([task()]));
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ schemaVersion: 1, settings: { onboardingDone: true, ...settings } })
    );
    await renderRouter(
      { _layout: RootLayout, index: MatrixScreen, settings: SettingsScreen },
      { initialUrl: "/" }
    );
  };

  beforeEach(() => AsyncStorage.clear());

  it("changement à chaud : écrans, notifications programmées, boutons et canal", async () => {
    await openApp();
    expect(await screen.findByText(fr.matrix.title)).toBeOnTheScreen();
    await waitFor(() => expect(bodies()).toContain(fr.notifications.weeklyReview));

    await fireEvent.press(screen.getByRole("button", { name: fr.common.settings }));
    await fireEvent.press(
      await screen.findByRole("button", { name: `${fr.settings.language}, ${fr.settings.languageAuto}` })
    );
    await fireEvent.press(screen.getByRole("radio", { name: "English" }));

    // Écran affiché et écran de la matrice, sans relancer l'app
    expect(await screen.findByRole("header", { name: en.settings.title })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: `${en.settings.language}, English` })).toBeOnTheScreen();
    expect(screen.getByText(en.settings.defaults)).toBeOnTheScreen();

    // Notifications reprogrammées dans la nouvelle langue
    await waitFor(() => expect(bodies()).toEqual([en.notifications.weeklyReview]));
    await waitFor(() => expect(mock.__state.channels.reminders.name).toBe(en.notifications.channel));
    expect(mock.__state.categories["task-reminder"].map((a) => a.buttonTitle)).toEqual([
      en.notifications.actionDone,
      en.notifications.actionSnooze,
      en.notifications.actionOpen,
    ]);
    expect(mock.__state.categories["task-step"].map((a) => a.buttonTitle)).toEqual([
      en.notifications.actionDone,
      en.notifications.actionPostpone,
    ]);

    // Choix enregistré dans les réglages
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!).settings.language).toBe("en")
    );

    await fireEvent.press(screen.getByRole("button", { name: en.common.back }));
    expect(await screen.findByText(en.matrix.title)).toBeOnTheScreen();
  });

  it("langue enregistrée : appliquée au démarrage, même si le téléphone est dans une autre langue", async () => {
    await openApp({ language: "en" });
    expect(await screen.findByText(en.matrix.title)).toBeOnTheScreen();
    await waitFor(() => expect(bodies()).toEqual([en.notifications.weeklyReview]));
    expect(currentLanguage()).toBe("en");
  });
});
