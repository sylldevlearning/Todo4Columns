import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Appearance, StatusBar, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import { CELEBRATION_STYLES } from "../celebration/plan";
import SystemBars from "../components/SystemBars";
import { CATEGORIES, CATEGORY_BY_KEY } from "../constants/categories";
import { setLanguagePreference } from "../i18n";
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from "../settings";
import { TasksProvider, useSettings } from "../store/TasksContext";
import {
  colors,
  getScheme,
  Palette,
  PALETTES,
  resetThemeForTests,
  Scheme,
  setAppearancePreference,
  subscribeScheme,
  themedStyles,
  withAlpha,
} from "../theme";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";
import { renderWidget } from "../widgets/render";

/* eslint-disable @typescript-eslint/no-require-imports */
declare const require: (id: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
declare const __dirname: string;
const fs = require("fs");
const path = require("path");
const { buildWidgetTree } = require("react-native-android-widget/lib/commonjs/api/build-widget-tree");

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(Appearance, "getColorScheme").mockReturnValue("dark");
  resetThemeForTests();
  setLanguagePreference("fr");
});
afterEach(() => {
  setAppearancePreference("auto");
  jest.restoreAllMocks();
});

// ---- Contrastes (WCAG) ----

const channels = (c: string): [number, number, number, number] => {
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(c);
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], +rgba[4]];
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
};
// Couleur (éventuellement transparente) posée sur un fond opaque
const over = (c: string, base: string) => {
  const [r, g, b, a] = channels(c);
  const [R, G, B] = channels(base);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)];
};
const luminance = ([r, g, b]: number[]) =>
  [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (text: string, background: string, base: string = background) => {
  const a = luminance(over(text, base));
  const b = luminance(over(background, base));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// Paires principales : textes sur leurs fonds réels (fond, surfaces, teintes de quadrant)
function pairs(p: Palette): [string, string, string, string][] {
  const list: [string, string, string, string][] = [];
  const add = (name: string, text: string, background: string, base = background) => list.push([name, text, background, base]);
  for (const bg of ["bg", "surface", "surfaceRaised"] as const) {
    add(`text/${bg}`, p.text, p[bg]);
    add(`textMuted/${bg}`, p.textMuted, p[bg]);
    add(`danger/${bg}`, p.danger, p[bg]);
  }
  add("success/bg", p.success, p.bg);
  add("warning/bg", p.warning, p.bg);
  for (const [key, q] of Object.entries(p.quadrants)) {
    add(`${key} texte/bg`, q.textColor, p.bg);
    add(`${key} texte/surface`, q.textColor, p.surface);
    // Cases et cartes teintées (withAlpha jusqu'à 0,18), sur le fond et sur les surfaces
    add(`${key} texte/teinte bg`, q.textColor, withAlpha(q.color, 0.18), p.bg);
    add(`${key} texte/teinte surface`, q.textColor, withAlpha(q.color, 0.18), p.surface);
    add(`${key} texte sur la couleur`, q.onColor, q.color);
    add(`text/teinte ${key}`, p.text, withAlpha(q.color, 0.18), p.bg);
  }
  return list;
}

describe.each(["dark", "light"] as Scheme[])("contrastes du thème %s", (scheme) => {
  it.each(pairs(PALETTES[scheme]))("%s : au moins 4,5:1", (_name, text, background, base) => {
    expect(contrast(text, background, base)).toBeGreaterThanOrEqual(4.5);
  });
});

it("palette claire : fond, surfaces, bordures, textes et quadrants demandés (Faire, Planifier, Déléguer, Si j'ai le temps)", () => {
  const p = PALETTES.light;
  expect([p.bg, p.surface, p.border, p.text, p.textMuted]).toEqual(["#F6F7F9", "#FFFFFF", "#E3E6EB", "#14161A", "#5B6270"]);
  expect([p.quadrants.UI.color, p.quadrants.INU.color, p.quadrants.UDI.color, p.quadrants.NDNI.color]).toEqual([
    "#D9532F",
    "#2F6FDB",
    "#B7791F",
    "#6B7280",
  ]);
});

// ---- Aucune couleur en dur hors du thème ----

it("aucune couleur codée en dur dans l'app : tout passe par src/theme.ts", () => {
  const root = path.resolve(__dirname, "../..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["__tests__", "testing", "node_modules"].includes(entry.name)) walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, "app"));
  walk(path.join(root, "src"));
  const offenders: string[] = [];
  for (const file of files) {
    if (file.endsWith(path.join("src", "theme.ts"))) continue;
    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line: string, i: number) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(code) && !/^\s*\*/.test(code)) {
          offenders.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
        }
      });
  }
  expect(offenders).toEqual([]);
});

// ---- Réglage « Apparence » ----

describe("réglage « Apparence »", () => {
  it("automatique par défaut ; réglages d'avant la 1.6 compatibles ; valeur inconnue ignorée", () => {
    expect(DEFAULT_SETTINGS.appearance).toBe("auto");
    expect(parseSettings(JSON.stringify({ schemaVersion: 1, settings: { language: "fr" } })).appearance).toBe("auto");
    expect(parseSettings(JSON.stringify({ schemaVersion: 1, settings: { appearance: "violet" } })).appearance).toBe("auto");
    expect(parseSettings(JSON.stringify({ schemaVersion: 1, settings: { appearance: "light" } })).appearance).toBe("light");
  });

  it("automatique : suit le téléphone, et en change avec lui", () => {
    const listeners: ((p: { colorScheme: "light" | "dark" | null }) => void)[] = [];
    jest.spyOn(Appearance, "addChangeListener").mockImplementation((l) => {
      listeners.push(l as never);
      return { remove: () => {} } as never;
    });
    jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
    const seen: Scheme[] = [];
    const unsubscribe = subscribeScheme(() => seen.push(getScheme()));
    expect(getScheme()).toBe("dark");
    (Appearance.getColorScheme as jest.Mock).mockReturnValue("light");
    listeners.forEach((l) => l({ colorScheme: "light" }));
    expect(getScheme()).toBe("light");
    expect(seen).toEqual(["light"]); // les écrans abonnés sont redessinés
    // Choix fixe : le téléphone ne change plus rien
    setAppearancePreference("dark");
    (Appearance.getColorScheme as jest.Mock).mockReturnValue("light");
    listeners.forEach((l) => l({ colorScheme: "light" }));
    expect(getScheme()).toBe("dark");
    unsubscribe();
  });

  it("choix fixe appliqué aussi aux fenêtres du système (alertes, sélecteurs)", () => {
    const set = jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
    setAppearancePreference("light");
    expect(set).toHaveBeenLastCalledWith("light");
    setAppearancePreference("auto");
    expect(set).toHaveBeenLastCalledWith("unspecified");
  });

  it("Réglages › Apparence : choix mémorisé, changement à chaud sans relancer l'app", async () => {
    jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
    let settings = DEFAULT_SETTINGS;
    function Grab() {
      settings = useSettings();
      return null;
    }
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Grab />
          <SettingsScreen />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText("Apparence")).toBeOnTheScreen());
    const title = screen.getByText("Réglages");
    const colorOf = () => StyleSheet.flatten(title.props.style).color;
    expect(colorOf()).toBe(PALETTES.dark.text);

    await fireEvent.press(screen.getByRole("radio", { name: "Clair" }));
    await act(async () => {});
    expect(settings.appearance).toBe("light");
    expect(getScheme()).toBe("light");
    // Même écran, redessiné avec la palette claire
    expect(screen.getByText("Réglages")).toBe(title);
    expect(colorOf()).toBe(PALETTES.light.text);
    await waitFor(async () => expect((await loadSettings()).appearance).toBe("light"));

    await fireEvent.press(screen.getByRole("radio", { name: "Sombre" }));
    await act(async () => {});
    expect(colorOf()).toBe(PALETTES.dark.text);
    expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!).settings.appearance).toBeDefined();
  });

  it("« i » du réglage", async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <SettingsScreen />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await waitFor(() => expect(screen.getByText("Apparence")).toBeOnTheScreen());
    await fireEvent.press(screen.getByLabelText("En savoir plus : Apparence"));
    expect(screen.getByText(/suit le thème du téléphone/)).toBeOnTheScreen();
  });
});

// ---- Couleurs lues à chaque accès ----

describe("couleurs du thème courant partout", () => {
  it("couleurs, quadrants, confettis et feuilles de styles suivent le thème", () => {
    const styles = themedStyles(() => StyleSheet.create({ box: { backgroundColor: colors.bg } }));
    expect(styles.box.backgroundColor).toBe(PALETTES.dark.bg);
    expect(CATEGORY_BY_KEY.UI.color).toBe(PALETTES.dark.quadrants.UI.color);
    expect(CELEBRATION_STYLES.UI.colors).toContain(PALETTES.dark.quadrants.UI.sparkle);
    setAppearancePreference("light");
    expect(colors.bg).toBe(PALETTES.light.bg);
    expect(styles.box.backgroundColor).toBe(PALETTES.light.bg);
    expect(CATEGORIES.map((c) => c.textColor)).toEqual(
      (["UI", "INU", "UDI", "NDNI"] as const).map((k) => PALETTES.light.quadrants[k].textColor)
    );
    expect(CELEBRATION_STYLES.UI.colors).toContain(PALETTES.light.quadrants.UI.sparkle);
  });

  it("barres système : icônes claires en sombre, foncées en clair", async () => {
    const setBarStyle = jest.spyOn(StatusBar, "setBarStyle").mockImplementation(() => {});
    await render(<SystemBars />);
    expect(setBarStyle).toHaveBeenLastCalledWith("light-content", true);
    await act(async () => setAppearancePreference("light"));
    expect(setBarStyle).toHaveBeenLastCalledWith("dark-content", true);
  });

  it("widgets : thème choisi dans l'app, ou les deux versions en automatique (Android choisit)", () => {
    const tasks = [makeTask({ id: "t", category: "UI" })];
    const size = { width: 110, height: 200 };
    const auto = renderWidget("DoFirstDo", size, { tasks, settings: DEFAULT_SETTINGS, now: Date.now() }) as {
      light: React.JSX.Element;
      dark: React.JSX.Element;
    };
    expect(buildWidgetTree(auto.light).props.backgroundColor).toBe(PALETTES.light.bg);
    expect(buildWidgetTree(auto.dark).props.backgroundColor).toBe(PALETTES.dark.bg);
    const light = renderWidget("DoFirstDo", size, { tasks, settings: { ...DEFAULT_SETTINGS, appearance: "light" }, now: Date.now() });
    expect(buildWidgetTree(light as React.JSX.Element).props.backgroundColor).toBe(PALETTES.light.bg);
  });

  it("écran de démarrage clair et sombre selon le téléphone ; mode automatique déclaré", () => {
    const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../app.json"), "utf8"));
    expect(appJson.expo.userInterfaceStyle).toBe("automatic");
    const splash = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
    expect(splash.backgroundColor).toBe(PALETTES.light.bg);
    expect(splash.dark.backgroundColor).toBe(PALETTES.dark.bg);
  });

  it("outil de captures : version claire possible, rangée à part", () => {
    const capture = fs.readFileSync(path.resolve(__dirname, "../../scripts/store-screenshots/capture.mjs"), "utf8");
    expect(capture).toContain('args.theme === "light"');
    expect(capture).toContain('path.join(OUT, "light", language)');
  });
});
