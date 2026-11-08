import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FirstLaunchOnboarding } from "../components/Onboarding";
import PermissionCard from "../components/PermissionCard";
import RemindersCard from "../components/RemindersCard";
import { fr } from "../i18n/fr";
import { hidePermissionCard } from "../notifications/permissionCard";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from "../settings";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

const mock = Notifications as unknown as {
  __state: { permission: string; canAskAgain: boolean; requestResult?: string };
};
const request = Notifications.requestPermissionsAsync as jest.Mock;

// Application lancée (ou relancée) : présentation, carte de la matrice et carte « Ouvrir les réglages »
const launch = async () => {
  const result = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <FirstLaunchOnboarding />
        <RemindersCard />
        <PermissionCard />
      </TasksProvider>
    </SafeAreaProvider>
  );
  // Lecture des tâches, des réglages et de l'autorisation
  await act(async () => {});
  await act(async () => {});
  await act(async () => {});
  return result;
};

const saveRaw = (settings: object) =>
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, settings }));

// Dernier écran de la présentation : « Ne rate plus rien »
const goToRemindersPage = async () => {
  for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByRole("button", { name: fr.onboarding.next }));
  expect(screen.getByRole("header", { name: fr.onboarding.reminders.title })).toBeOnTheScreen();
};

const onboardingShown = () => screen.queryByText(fr.onboarding.matrix.title) !== null;
const cardShown = () => screen.queryByTestId("reminders-card") !== null;

beforeEach(async () => {
  await AsyncStorage.clear();
  request.mockClear();
  hidePermissionCard();
});

describe("présentation : écran « Ne rate plus rien »", () => {
  it("autorisation accordée : fenêtre système, puis fin de la présentation", async () => {
    mock.__state.permission = "undetermined";
    mock.__state.requestResult = "granted";
    await launch();
    await goToRemindersPage();
    expect(screen.getByText(fr.onboarding.reminders.body)).toBeOnTheScreen();
    // « Passer » sur chaque écran, celui-ci compris
    expect(screen.getByRole("button", { name: fr.onboarding.skip })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Activer les rappels" }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(mock.__state.permission).toBe("granted");
    expect(onboardingShown()).toBe(false);
    await waitFor(async () =>
      expect(await loadSettings()).toMatchObject({ onboardingDone: true, remindersPromptDone: true })
    );
  });

  it("autorisation refusée : la présentation se termine aussi, et rien n'est redemandé ensuite", async () => {
    mock.__state.permission = "undetermined";
    mock.__state.requestResult = "denied";
    const app = await launch();
    await goToRemindersPage();

    await fireEvent.press(screen.getByRole("button", { name: "Activer les rappels" }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(onboardingShown()).toBe(false);
    // Refusée une fois, Android pourrait la réafficher : pas de carte « Ouvrir les réglages »
    expect(screen.queryByTestId("permission-card")).toBeNull();
    await waitFor(async () => expect((await loadSettings()).remindersPromptDone).toBe(true));

    // Lancements suivants : ni présentation, ni carte, ni fenêtre système
    for (let i = 0; i < 2; i++) {
      await app.unmount();
      await launch();
      expect(onboardingShown()).toBe(false);
      expect(cardShown()).toBe(false);
    }
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("refusée et fenêtre système plus disponible : la carte « Ouvrir les réglages » prend le relais", async () => {
    mock.__state.permission = "denied";
    mock.__state.canAskAgain = false;
    await launch();
    await goToRemindersPage();

    await fireEvent.press(screen.getByRole("button", { name: "Activer les rappels" }));
    expect(request).not.toHaveBeenCalled();
    expect(onboardingShown()).toBe(false);
    expect(screen.getByTestId("permission-card")).toBeOnTheScreen();
    expect(screen.getByText(fr.permissionCard.openSettings)).toBeOnTheScreen();
  });

  it("déjà accordée : « Les rappels sont activés » et « C'est parti », sans rien demander", async () => {
    mock.__state.permission = "granted";
    await launch();
    await goToRemindersPage();
    expect(screen.getByText("Les rappels sont activés")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Activer les rappels" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Plus tard" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "C'est parti" }));
    expect(request).not.toHaveBeenCalled();
    expect(onboardingShown()).toBe(false);
  });

  it("« Plus tard » termine la présentation sans rien demander, ni maintenant ni ensuite", async () => {
    mock.__state.permission = "undetermined";
    const app = await launch();
    await goToRemindersPage();

    await fireEvent.press(screen.getByRole("button", { name: "Plus tard" }));
    expect(onboardingShown()).toBe(false);
    expect(request).not.toHaveBeenCalled();
    await waitFor(async () =>
      expect(await loadSettings()).toMatchObject({ onboardingDone: true, remindersPromptDone: true })
    );

    // Pas de carte sur la matrice non plus : l'autorisation a déjà été proposée
    await app.unmount();
    await launch();
    expect(cardShown()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("mise à jour : carte « Active les rappels » sur la matrice", () => {
  // Présentation vue avant la 1.4.1, autorisation jamais demandée
  const updater = () => saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true });

  it("affichée une seule fois, puis plus jamais après « Plus tard »", async () => {
    mock.__state.permission = "undetermined";
    await updater();
    const app = await launch();
    expect(onboardingShown()).toBe(false);
    expect(cardShown()).toBe(true);
    expect(screen.getByText("Active les rappels pour ne rien oublier")).toBeOnTheScreen();
    // Notée comme proposée dès son affichage
    await waitFor(async () => expect((await loadSettings()).remindersPromptDone).toBe(true));

    await fireEvent.press(screen.getByRole("button", { name: "Plus tard" }));
    expect(cardShown()).toBe(false);
    expect(request).not.toHaveBeenCalled();

    await app.unmount();
    await launch();
    expect(cardShown()).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("affichée une seule fois même sans réponse : l'app relancée ne la remontre pas", async () => {
    mock.__state.permission = "undetermined";
    await updater();
    const app = await launch();
    expect(cardShown()).toBe(true);
    await waitFor(async () => expect((await loadSettings()).remindersPromptDone).toBe(true));

    await app.unmount();
    await launch();
    expect(cardShown()).toBe(false);
  });

  it("« Activer » affiche la fenêtre système, puis la carte disparaît", async () => {
    mock.__state.permission = "undetermined";
    mock.__state.requestResult = "granted";
    await updater();
    await launch();

    await fireEvent.press(screen.getByRole("button", { name: "Activer" }));
    expect(cardShown()).toBe(false);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(mock.__state.permission).toBe("granted");
  });

  it.each([
    ["refusée", "denied"],
    ["déjà accordée", "granted"],
  ])("autorisation %s : pas de carte, rien demandé au lancement", async (_, permission) => {
    mock.__state.permission = permission;
    await updater();
    await launch();
    expect(cardShown()).toBe(false);
    expect(screen.queryByTestId("permission-card")).toBeNull();
    expect(request).not.toHaveBeenCalled();
    expect((await loadSettings()).remindersPromptDone).toBeUndefined();
  });

  it("jamais pendant la présentation d'une première installation", async () => {
    mock.__state.permission = "undetermined";
    await launch();
    expect(onboardingShown()).toBe(true);
    expect(cardShown()).toBe(false);
  });
});

describe("réglage remindersPromptDone", () => {
  it("absent des réglages d'avant la 1.4.1, gardé une fois enregistré", async () => {
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true });
    expect((await loadSettings()).remindersPromptDone).toBeUndefined();
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true });
    expect((await loadSettings()).remindersPromptDone).toBe(true);
    await saveRaw({ ...DEFAULT_SETTINGS, remindersPromptDone: "oui" });
    expect((await loadSettings()).remindersPromptDone).toBeUndefined();
  });
});
