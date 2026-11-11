import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert, AlertButton } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import { ARCHIVE_AFTER_MS } from "../archive";
import { COMPLETION_LOG_KEY } from "../completionLog";
import DriveSync from "../components/DriveSync";
import { resetDriveStateForTests, updateDriveState } from "../drive/driveBackup";
import * as account from "../drive/googleAccount";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { resetSyncControllerForTests } from "../sync/controller";
import { resetTombstonesForTests } from "../sync/localChanges";
import { EMPTY_SYNC_DATA, mergeData } from "../sync/merge";
import { buildSyncFile, COPY_PREFIX, parseSyncFile, SYNC_FILE_NAME } from "../sync/syncFile";
import { createFakeDrive, FakeDrive } from "../testing/fakeDrive";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";
import { Task } from "../types";

// Scénarios de la revue de la synchronisation côté app (points 1, 3, 4, 5, 8, 10). Chacun
// échouait avant sa correction.

jest.mock("../drive/googleAccount", () => ({
  ...jest.requireActual("../drive/googleAccount"),
  isDriveAvailable: () => true,
  signIn: jest.fn(async () => "lea@example.com"),
  accessToken: jest.fn(async () => "jeton-1"),
  discardToken: jest.fn(async () => {}),
  signOut: jest.fn(async () => {}),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
const mocked = account as jest.Mocked<typeof account>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let fake: FakeDrive;
let actions: TaskActions;
let tasksState: TasksState;
function Grab() {
  actions = useTaskActions();
  tasksState = useTasksSelector((s) => s);
  return null;
}
const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};
const renderApp = async () => {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Grab />
        <SettingsScreen />
        <DriveSync />
      </TasksProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(tasksState.isLoaded).toBe(true));
  await flush();
};
let alerts: { title: string; message?: string; buttons?: AlertButton[] }[];
const pressAlertButton = async (label: string) => {
  const button = alerts.at(-1)!.buttons!.find((b) => b.text === label)!;
  await act(async () => {
    await button.onPress?.();
  });
  await flush();
};
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flush();
};
const putSyncFile = (tasks: Task[]) =>
  fake.seed(SYNC_FILE_NAME, buildSyncFile({ ...EMPTY_SYNC_DATA, tasks }, null, Date.now() - HOUR), { tasks: String(tasks.length) });
const remoteIds = () => {
  const [file] = fake.filesNamed(SYNC_FILE_NAME);
  const parsed = parseSyncFile(fake.contentOf(file));
  return parsed.ok ? parsed.file.data.tasks.map((t) => t.id).sort() : null;
};
const connected = () => updateDriveState({ account: "lea@example.com", autoBackup: true });

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveStateForTests();
  resetSyncControllerForTests();
  resetTombstonesForTests();
  fake = createFakeDrive();
  globalThis.fetch = fake.fetch as unknown as typeof fetch;
  mocked.signIn.mockReset().mockResolvedValue("lea@example.com");
  mocked.accessToken.mockReset().mockResolvedValue("jeton-1");
  alerts = [];
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    alerts.push({ title, message, buttons });
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false, autoEscalate: false });
});
afterEach(() => {
  resetSyncControllerForTests();
  jest.restoreAllMocks();
});

describe("1. journal illisible au lancement", () => {
  it("aucune synchronisation tant que le journal n'est pas chargé", async () => {
    await connected();
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t" })]));
    const getItem = AsyncStorage.getItem as jest.Mock;
    const original = getItem.getMockImplementation()!;
    getItem.mockImplementation((key: string) =>
      key === COMPLETION_LOG_KEY ? Promise.reject(new Error("lecture impossible")) : original(key)
    );
    await renderApp();
    expect(tasksState.logReady).toBe(false);
    expect(fake.state.requests).toEqual([]);
    getItem.mockImplementation(original);
  });
});

describe("3. changements automatiques datés de façon fixe", () => {
  const load = async (tasks: Task[], settings = DEFAULT_SETTINGS) => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    const hook = await renderHook(() => useTasks(settings));
    await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
    await act(async () => {});
    return hook;
  };

  it("bascule en Faire : modifiedAt = échéance, pas l'heure où le téléphone s'en aperçoit", async () => {
    const dueAt = Date.now() - 3 * DAY;
    const { result } = await load([makeTask({ id: "t", category: "INU", dueAt, modifiedAt: dueAt - DAY })]);
    await waitFor(() => expect(result.current.tasks[0].category).toBe("UI"));
    expect(result.current.tasks[0].modifiedAt).toBe(dueAt);
  });

  it("archivage : modifiedAt = arrivée dans le quadrant + 7 jours", async () => {
    const categoryChangedAt = Date.now() - 10 * DAY;
    const { result } = await load(
      [makeTask({ id: "t", category: "NDNI", categoryChangedAt, modifiedAt: categoryChangedAt })],
      { ...DEFAULT_SETTINGS, autoArchive: true }
    );
    await waitFor(() => expect(result.current.tasks[0].archivedAt).not.toBeNull());
    expect(result.current.tasks[0].modifiedAt).toBe(categoryChangedAt + ARCHIVE_AFTER_MS);
  });

  it("fin du minuteur : modifiedAt = fin prévue du minuteur", async () => {
    const timerEnd = Date.now() - HOUR;
    const { result } = await load([makeTask({ id: "t", timerEnd, modifiedAt: timerEnd - HOUR })]);
    await waitFor(() => expect(result.current.tasks[0].timerEnd).toBeNull());
    expect(result.current.tasks[0].modifiedAt).toBe(timerEnd);
  });

  it("deux téléphones : un déplacement fait ailleurs n'est pas écrasé par l'archivage au lancement", async () => {
    await connected();
    const categoryChangedAt = Date.now() - 10 * DAY;
    const stale = makeTask({ id: "t", title: "Ranger le garage", category: "NDNI", categoryChangedAt, modifiedAt: categoryChangedAt });
    // Ce téléphone (resté fermé) a l'ancienne version ; l'autre l'a déplacée dans « Faire » hier
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([stale]));
    putSyncFile([{ ...stale, category: "UI", categoryChangedAt: Date.now() - DAY, modifiedAt: Date.now() - DAY }]);
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false, autoArchive: true, autoEscalate: false });
    await renderApp();
    await waitFor(() => expect(tasksState.tasks[0].category).toBe("UI"));
    expect(tasksState.tasks[0].archivedAt).toBeNull();
  });
});

describe("4. « Reporter 1 h » propre au téléphone", () => {
  it("ne change pas modifiedAt", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t", modifiedAt: 1000 })]));
    const { result } = await renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await act(async () => result.current.snoozeTask("t"));
    expect(result.current.tasks[0].snoozedUntil).not.toBeNull();
    expect(result.current.tasks[0].modifiedAt).toBe(1000);
  });
});

describe("5. « Annuler le dernier import » après une action de synchronisation", () => {
  it("après « Remplacer par Google Drive » : restauré par fusion, rien n'est supprimé en ligne", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "local", title: "Tâche du téléphone" })]));
    putSyncFile([makeTask({ id: "a", modifiedAt: Date.now() - HOUR }), makeTask({ id: "b", modifiedAt: Date.now() - HOUR })]);
    await renderApp();
    await press("Synchroniser avec Google Drive");
    await pressAlertButton("Remplacer par Google Drive");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b"]));

    await press("Annuler le dernier import");
    expect(alerts.at(-1)!.message).toMatch(/rien n'est supprimé/);
    await pressAlertButton("Restaurer");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b", "local"]));
    await press("Synchroniser maintenant");
    expect(remoteIds()).toEqual(["a", "b", "local"]);
  });

  it("après « Revenir à une copie » : les tâches d'avant reviennent, même supprimées par la copie", async () => {
    await connected();
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "local", modifiedAt: Date.now() - HOUR })]));
    fake.seed(`${COPY_PREFIX}2026-11-01.json`, buildSyncFile({ ...EMPTY_SYNC_DATA, tasks: [makeTask({ id: "vieille" })] }, null, Date.now() - 48 * HOUR), {
      tasks: "1",
    });
    await renderApp();
    await press("Revenir à une copie…");
    await fireEvent.press(screen.getAllByRole("button", { name: /· 1 tâche$/ }).at(-1)!);
    await flush();
    await pressAlertButton("Revenir à cette copie");
    expect(remoteIds()).toEqual(["vieille"]);

    await press("Annuler le dernier import");
    await pressAlertButton("Restaurer");
    await press("Synchroniser maintenant");
    expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["local", "vieille"]);
    expect(remoteIds()).toEqual(["local", "vieille"]);
  });
});

describe("8. occurrence suivante d'une tâche récurrente", () => {
  const recurring = makeTask({
    id: "r",
    category: "INU",
    dueAt: new Date(2026, 10, 10, 9, 0).getTime(),
    reminderOffset: 60,
    recurrence: { freq: "daily", hour: 9, minute: 0 },
  });
  // Un téléphone : charge les tâches enregistrées et termine la tâche récurrente
  const finishOnAPhone = async () => {
    const hook = await renderHook(() => useTasks());
    await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
    await act(async () => hook.result.current.toggleDone("r"));
    const tasks = hook.result.current.tasks;
    hook.unmount();
    return tasks;
  };

  it("deux téléphones la terminent hors ligne : une seule occurrence après fusion", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([recurring]));
    const onA = await finishOnAPhone();
    resetTombstonesForTests();
    await new Promise((r) => setTimeout(r, 5)); // l'autre téléphone, un peu plus tard
    const onB = await finishOnAPhone();
    expect(onA.find((t) => t.id !== "r")!.id).toBe(`r-next-${recurring.dueAt}`);
    const merged = mergeData({ ...EMPTY_SYNC_DATA, tasks: onA }, { ...EMPTY_SYNC_DATA, tasks: onB }, Date.now());
    expect(merged.tasks.filter((t) => t.id !== "r")).toHaveLength(1);
  });

  it("occurrence déjà reçue d'un autre téléphone : pas de doublon", async () => {
    const spawned = makeTask({ id: `r-next-${recurring.dueAt}`, category: "INU" });
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([recurring, spawned]));
    const { result } = await renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await act(async () => result.current.toggleDone("r"));
    expect(result.current.tasks.filter((t) => t.id === spawned.id)).toHaveLength(1);
    expect(result.current.tasks.find((t) => t.id === "r")!.nextOccurrenceId).toBe(spawned.id);
  });
});

describe("10. téléphone « vide » à la connexion", () => {
  it("sans tâches mais avec un journal : la question est posée, rien n'est remplacé d'office", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([]));
    await AsyncStorage.setItem(COMPLETION_LOG_KEY, JSON.stringify({ schemaVersion: 1, entries: [{ date: Date.now() - DAY, category: "UI" }] }));
    putSyncFile([makeTask({ id: "a" })]);
    await renderApp();
    await press("Synchroniser avec Google Drive");
    expect(alerts.at(-1)!.title).toBe("Des tâches des deux côtés");
    expect(tasksState.completions).toHaveLength(1);
  });
});
