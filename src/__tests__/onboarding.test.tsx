import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, Dimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import { FirstLaunchOnboarding } from "../components/Onboarding";
import { getDriveState, resetDriveStateForTests } from "../drive/driveBackup";
import * as account from "../drive/googleAccount";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from "../settings";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

// Google Drive disponible (Android) ou non (iOS), connexion simulée
const mockDrive = { available: true };
jest.mock("../drive/googleAccount", () => {
  const actual = jest.requireActual("../drive/googleAccount");
  return {
    ...actual,
    isDriveAvailable: () => mockDrive.available,
    signIn: jest.fn(async () => "lea@example.com"),
    accessToken: jest.fn(async () => "jeton"),
  };
});
const mocked = account as jest.Mocked<typeof account>;
// Drive vide : rien à restaurer après connexion
globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) })) as unknown as typeof fetch;

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
const next = () => fireEvent.press(screen.getByRole("button", { name: "Suivant" }));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveStateForTests();
  mockDrive.available = true;
  mocked.signIn.mockClear();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("présentation au premier lancement", () => {
  it("s'affiche au premier lancement, puis plus jamais après « Passer »", async () => {
    const app = await launch();
    expect(screen.getByRole("header", { name: firstTitle })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Passer" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    // Écriture des réglages regroupée : on l'attend
    await waitFor(async () => expect((await loadSettings()).onboardingDone).toBe(true));

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
    await waitFor(async () =>
      expect(await loadSettings()).toEqual({
        ...DEFAULT_SETTINGS,
        doNagInterval: 30,
        autoArchive: true,
        onboardingDone: true,
        // Présentation vue : la carte des rappels ne les reproposera pas ; passée avant l'écran
        // Google Drive, la sauvegarde sera proposée plus tard par la carte de la matrice
        remindersPromptDone: true,
        driveDeferred: true,
      })
    );

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

  it("6 écrans, « Passer » sur chacun : matrice, questions, gestes et étapes, calendrier et dictée, rappels, Google Drive", async () => {
    // Autorisation des notifications déjà accordée (Android 12 et avant)
    await launch();
    const titles = [
      fr.onboarding.matrix.title,
      fr.onboarding.create.title,
      fr.onboarding.gestures.title,
      fr.onboarding.calendar.title,
      fr.onboarding.reminders.title,
    ];
    for (const [i, title] of titles.entries()) {
      expect(screen.getByLabelText(`Écran ${i + 1} sur 6`)).toBeOnTheScreen();
      expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Passer" })).toBeOnTheScreen();
      if (i === 4) expect(screen.getByText("Les rappels sont activés")).toBeOnTheScreen();
      await next();
    }

    // Dernier écran : Google Drive, facultatif
    expect(screen.getByLabelText("Écran 6 sur 6")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Sauvegarde Google Drive" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Passer" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Plus tard" })).toBeOnTheScreen();
    expect(mocked.signIn).not.toHaveBeenCalled(); // jamais sans appui

    await fireEvent.press(screen.getByRole("button", { name: "Se connecter" }));
    await act(async () => {});
    expect(mocked.signIn).toHaveBeenCalledTimes(1);
    expect(getDriveState()).toMatchObject({ account: "lea@example.com", autoBackup: true });
    expect(screen.getByText("Connecté : sauvegarde automatique activée")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "C'est parti" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    await waitFor(async () => expect(await loadSettings()).toMatchObject({ onboardingDone: true, drivePromptDone: true }));
  });

  it("« Passer » avant l'écran Google Drive : proposé plus tard ; sur l'écran Google Drive : non", async () => {
    const app = await launch();
    await next();
    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    await waitFor(async () => expect(await loadSettings()).toMatchObject({ onboardingDone: true, driveDeferred: true }));
    expect((await loadSettings()).drivePromptDone).toBeUndefined();
    await app.unmount();

    await AsyncStorage.clear();
    await launch();
    for (let i = 0; i < 5; i++) await next();
    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    await waitFor(async () => expect(await loadSettings()).toMatchObject({ onboardingDone: true, drivePromptDone: true }));
    expect((await loadSettings()).driveDeferred).toBeUndefined();
  });

  it("sans Google Drive (iOS), « Passer » ne laisse rien en attente", async () => {
    mockDrive.available = false;
    await launch();
    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    await waitFor(async () => expect(await loadSettings()).toMatchObject({ onboardingDone: true, drivePromptDone: true }));
    expect((await loadSettings()).driveDeferred).toBeUndefined();
  });

  it("Google Drive : « Plus tard » termine sans connexion", async () => {
    await launch();
    for (let i = 0; i < 5; i++) await next();
    await fireEvent.press(screen.getByRole("button", { name: "Plus tard" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    expect(mocked.signIn).not.toHaveBeenCalled();
    expect(getDriveState().account).toBeNull();
  });

  it("sans Google Drive (iOS) : 5 écrans, les rappels en dernier", async () => {
    mockDrive.available = false;
    await launch();
    expect(screen.getByLabelText("Écran 1 sur 5")).toBeOnTheScreen();
    for (let i = 0; i < 4; i++) await next();
    expect(screen.getByRole("header", { name: "Ne rate plus rien" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "C'est parti" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
  });

  it("le bouton retour d'Android ferme la présentation comme « Passer »", async () => {
    await launch();
    await fireEvent(screen.getByTestId("onboarding"), "requestClose");
    expect(screen.queryByText(firstTitle)).toBeNull();
    // Écriture des réglages regroupée : on l'attend
    await waitFor(async () => expect((await loadSettings()).onboardingDone).toBe(true));
  });

  it("un défilement au doigt met à jour l'écran affiché", async () => {
    await launch();
    const { width } = Dimensions.get("window");
    await fireEvent(screen.getByTestId("onboarding-pager"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: width * 2, y: 0 } },
    });
    expect(screen.getByLabelText("Écran 3 sur 6")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeOnTheScreen();
  });
});

describe("« Revoir la présentation » dans les Réglages", () => {
  it("rouvre la présentation, que « Passer » referme", async () => {
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true });
    await launch(<SettingsScreen />);
    expect(screen.queryByText(firstTitle)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Revoir la présentation" }));
    expect(screen.getByText(firstTitle)).toBeOnTheScreen();
    expect(screen.getByLabelText("Écran 1 sur 6")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    expect(screen.queryByText(firstTitle)).toBeNull();
    expect((await loadSettings()).onboardingDone).toBe(true);
  });
});

describe("textes de la présentation", () => {
  it("6 écrans avec un titre et un texte, en français et en anglais", () => {
    for (const lang of [fr, en]) {
      for (const page of [
        lang.onboarding.matrix,
        lang.onboarding.create,
        lang.onboarding.gestures,
        lang.onboarding.calendar,
        lang.onboarding.reminders,
        lang.onboarding.drive,
      ]) {
        expect(page.title.trim()).not.toBe("");
        expect(page.body.trim()).not.toBe("");
      }
    }
    expect(en.onboarding.skip).toBe("Skip");
    expect(en.onboarding.replay).toBe("Replay the introduction");
    expect(en.onboarding.matrix.title).not.toBe(fr.onboarding.matrix.title);
  });
});
