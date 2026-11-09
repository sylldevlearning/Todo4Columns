import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DriveCard from "../components/DriveCard";
import RemindersCard from "../components/RemindersCard";
import { DRIVE_STATE_KEY, getDriveState, resetDriveStateForTests } from "../drive/driveBackup";
import * as account from "../drive/googleAccount";
import { serializeTasks } from "../migrations";
import { DEFAULT_SETTINGS, loadSettings, SETTINGS_KEY } from "../settings";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

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
globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) })) as unknown as typeof fetch;

const notifications = Notifications as unknown as { __state: { permission: string } };

// Matrice relancée : les deux cartes, comme dans app/index.tsx
const launch = async () => {
  const result = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <RemindersCard />
        <DriveCard />
      </TasksProvider>
    </SafeAreaProvider>
  );
  for (let i = 0; i < 4; i++) await act(async () => {});
  return result;
};
const saveRaw = (settings: object) => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ schemaVersion: 1, settings }));
const driveCard = () => screen.queryByTestId("drive-card");
const remindersCard = () => screen.queryByTestId("reminders-card");

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveStateForTests();
  mockDrive.available = true;
  mocked.signIn.mockClear();
  notifications.__state.permission = "granted";
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("carte Google Drive de la matrice (mise à jour)", () => {
  it("une seule fois pour qui a vu la présentation avant la 1.5", async () => {
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true });
    const app = await launch();
    expect(driveCard()).toBeOnTheScreen();
    await waitFor(async () => expect((await loadSettings()).drivePromptDone).toBe(true));

    await fireEvent.press(screen.getByRole("button", { name: "Plus tard" }));
    expect(driveCard()).toBeNull();
    await app.unmount();
    await launch();
    expect(driveCard()).toBeNull();
  });

  it("« Se connecter » : connexion, synchronisation activée, carte retirée", async () => {
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true });
    await launch();
    await fireEvent.press(screen.getByRole("button", { name: "Se connecter" }));
    await act(async () => {});
    expect(mocked.signIn).toHaveBeenCalledTimes(1);
    expect(getDriveState()).toMatchObject({ account: "lea@example.com", autoBackup: true });
    expect(driveCard()).toBeNull();
  });

  it("jamais en même temps que la carte des rappels : elle attend le lancement suivant", async () => {
    notifications.__state.permission = "undetermined";
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true });
    const app = await launch();
    expect(remindersCard()).toBeOnTheScreen();
    expect(driveCard()).toBeNull();
    // La carte Drive n'est pas notée comme proposée : elle reste pour le lancement suivant
    await waitFor(async () => expect((await loadSettings()).remindersPromptDone).toBe(true));
    expect((await loadSettings()).drivePromptDone).toBeUndefined();

    await app.unmount();
    await launch();
    expect(remindersCard()).toBeNull();
    expect(driveCard()).toBeOnTheScreen();
  });

  it("présentation passée avant Google Drive : carte une seule fois, à partir de 10 tâches", async () => {
    const tasks = (n: number) => Array.from({ length: n }, (_, i) => makeTask({ id: `t${i}`, title: `Tâche ${i}` }));
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true, driveDeferred: true });
    // 9 tâches (et une archivée, qui ne compte pas) : pas encore
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([...tasks(9), makeTask({ id: "arch", title: "Archivée", archivedAt: 1 })]));
    let app = await launch();
    expect(driveCard()).toBeNull();
    expect((await loadSettings()).drivePromptDone).toBeUndefined();
    await app.unmount();

    // 10 tâches : la carte s'affiche, notée comme proposée
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks(10)));
    app = await launch();
    expect(driveCard()).toBeOnTheScreen();
    await waitFor(async () => expect(await loadSettings()).toMatchObject({ drivePromptDone: true }));
    expect((await loadSettings()).driveDeferred).toBeUndefined();
    await app.unmount();

    // Plus jamais ensuite
    await launch();
    expect(driveCard()).toBeNull();
  });

  it("différée et 10 tâches, mais carte des rappels à afficher : elle passe d'abord", async () => {
    notifications.__state.permission = "undetermined";
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, driveDeferred: true });
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks(Array.from({ length: 12 }, (_, i) => makeTask({ id: `t${i}`, title: `Tâche ${i}` })))
    );
    const app = await launch();
    expect(remindersCard()).toBeOnTheScreen();
    expect(driveCard()).toBeNull();
    await waitFor(async () => expect((await loadSettings()).remindersPromptDone).toBe(true));
    await app.unmount();
    await launch();
    expect(driveCard()).toBeOnTheScreen();
  });

  it("pas de carte : nouvelle installation (présentation pas vue), déjà connecté, ou sans Google Drive", async () => {
    await launch();
    expect(driveCard()).toBeNull();

    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true });
    await AsyncStorage.setItem(DRIVE_STATE_KEY, JSON.stringify({ account: "lea@example.com", autoBackup: true }));
    resetDriveStateForTests();
    const app = await launch();
    expect(driveCard()).toBeNull();
    await app.unmount();

    await AsyncStorage.clear();
    resetDriveStateForTests();
    mockDrive.available = false;
    await saveRaw({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true });
    await launch();
    expect(driveCard()).toBeNull();
  });
});
