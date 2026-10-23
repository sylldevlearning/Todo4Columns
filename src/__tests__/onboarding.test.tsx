import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Dimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import { FirstLaunchOnboarding } from "../components/Onboarding";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from "../settings";
import { TasksProvider } from "../store/TasksContext";

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};

// Application relancée : nouveau TasksProvider qui relit les réglages enregistrés
const launch = async (screen: React.ReactNode = <FirstLaunchOnboarding />) => {
  const result = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>{screen}</TasksProvider>
    </SafeAreaProvider>
  );
  // Lecture des tâches et des réglages
  await act(async () => {});
  await act(async () => {});
  return result;
};

const saveRaw = (settings: object) =>
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, settings }));

const firstTitle = fr.onboarding.matrix.title;

describe("présentation au premier lancement", () => {
  beforeEach(() => AsyncStorage.clear());

  it("s'affiche au premier lancement, puis plus jamais après « Passer »", async () => {
    const app = await launch();
    expect(screen.getByRole("header", { name: firstTitle })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Passer" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    await act(async () => {});
    expect((await loadSettings()).onboardingDone).toBe(true);

    await app.unmount();
    await launch();
    expect(screen.queryByText(firstTitle)).toBeNull();
  });

  it("s'affiche une fois aux utilisateurs qui font la mise à jour, sans toucher à leurs réglages", async () => {
    // Réglages enregistrés par la 1.1, sans onboardingDone
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: undefined, doNagInterval: 30, autoArchive: true });
    const app = await launch();
    expect(screen.getByText(firstTitle)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    await act(async () => {});
    expect(await loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      doNagInterval: 30,
      autoArchive: true,
      onboardingDone: true,
    });

    await app.unmount();
    await launch();
    expect(screen.queryByText(firstTitle)).toBeNull();
  });

  it("n'apparaît jamais, même un instant, pour qui l'a déjà vue", async () => {
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true });
    // Premier rendu, avant la lecture des réglages
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <FirstLaunchOnboarding />
        </TasksProvider>
      </SafeAreaProvider>
    );
    expect(screen.queryByText(firstTitle)).toBeNull();
    await act(async () => {});
    await act(async () => {});
    expect(screen.queryByText(firstTitle)).toBeNull();
  });

  it("fait défiler les 3 écrans avec « Suivant », puis se termine avec « C'est parti »", async () => {
    await launch();
    expect(screen.getByLabelText("Écran 1 sur 3")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByLabelText("Écran 2 sur 3")).toBeOnTheScreen();
    expect(screen.getByText(fr.onboarding.create.title)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByLabelText("Écran 3 sur 3")).toBeOnTheScreen();
    expect(screen.getByText(fr.onboarding.gestures.title)).toBeOnTheScreen();
    // « Passer » reste visible jusqu'au dernier écran
    expect(screen.getByRole("button", { name: "Passer" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "C'est parti" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    await act(async () => {});
    expect((await loadSettings()).onboardingDone).toBe(true);
  });

  it("le bouton retour d'Android ferme la présentation comme « Passer »", async () => {
    await launch();
    await fireEvent(screen.getByTestId("onboarding"), "requestClose");
    expect(screen.queryByText(firstTitle)).toBeNull();
    await act(async () => {});
    expect((await loadSettings()).onboardingDone).toBe(true);
  });

  it("un défilement au doigt met à jour l'écran affiché", async () => {
    await launch();
    const { width } = Dimensions.get("window");
    await fireEvent(screen.getByTestId("onboarding-pager"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: width * 2, y: 0 } },
    });
    expect(screen.getByLabelText("Écran 3 sur 3")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "C'est parti" })).toBeOnTheScreen();
  });
});

describe("« Revoir la présentation » dans les Réglages", () => {
  beforeEach(() => AsyncStorage.clear());

  it("rouvre la présentation, que « Passer » referme", async () => {
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true });
    await launch(<SettingsScreen />);
    expect(screen.queryByText(firstTitle)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Revoir la présentation" }));
    expect(screen.getByText(firstTitle)).toBeOnTheScreen();
    expect(screen.getByLabelText("Écran 1 sur 3")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    expect((await loadSettings()).onboardingDone).toBe(true);
  });
});

describe("textes de la présentation", () => {
  it("3 écrans avec un titre et un texte, en français et en anglais", () => {
    for (const lang of [fr, en]) {
      for (const page of [lang.onboarding.matrix, lang.onboarding.create, lang.onboarding.gestures]) {
        expect(page.title.trim()).not.toBe("");
        expect(page.body.trim()).not.toBe("");
      }
    }
    expect(en.onboarding.skip).toBe("Skip");
    expect(en.onboarding.replay).toBe("Replay the introduction");
    expect(en.onboarding.matrix.title).not.toBe(fr.onboarding.matrix.title);
  });
});
