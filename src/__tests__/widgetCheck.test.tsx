import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { COMPLETION_LOG_KEY } from "../completionLog";
import { useTasks } from "../hooks/useTasks";
import { parseStoredTasks, serializeTasks } from "../migrations";
import { Notifier } from "../notifications/service";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { backupKeyFor, STORAGE_KEY } from "../storage";
import { resetTombstonesForTests, TOMBSTONES_KEY } from "../sync/localChanges";
import { makeTask } from "../testing/makeTask";
import { checkFromWidget } from "../widgets/complete";
import { setLiveApp } from "../widgets/liveApp";

// Coche depuis un widget avec l'app fermée : scénarios de la mini-revue. Chacun échouait avant
// sa correction.

const DAY = 24 * 60 * 60 * 1000;
const stored = async () => parseStoredTasks(await AsyncStorage.getItem(STORAGE_KEY)).tasks;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetTombstonesForTests();
  setLiveApp(null);
  await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  setLiveApp(null);
  jest.restoreAllMocks();
});

// Rappels simulés : chaque programmation rend de nouveaux identifiants, notés comme actifs ;
// une annulation les retire
function fakeNotifier(delay?: () => Promise<void>) {
  const active = new Set<string>();
  let next = 1;
  const notifier: Notifier = {
    syncTask: async (task) => {
      await delay?.();
      task.notificationIds.forEach((id) => active.delete(id));
      if (task.isDone) return [];
      const ids = [`n${next++}`];
      ids.forEach((id) => active.add(id));
      return ids;
    },
    cancel: async (ids) => ids.forEach((id) => active.delete(id)),
    reconcile: async () => ({}),
  };
  return { notifier, active };
}

describe("1. app qui s'ouvre au même moment", () => {
  it("app enregistrée mais pas encore prête : la coche attend, puis passe par l'app", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t", category: "UI" })]));
    let ready = false;
    const completeTask = jest.fn();
    setLiveApp({ isReady: () => ready, completeTask, completeStep: jest.fn() });
    setTimeout(() => (ready = true), 100);
    expect(await checkFromWidget({ taskId: "t", stepId: null })).toBe("live");
    expect(completeTask).toHaveBeenCalledWith("t");
    // Rien d'écrit à côté de l'app
    expect((await stored())[0].isDone).toBe(false);
  });

  it("le chargement des tâches par l'app attend la fin d'une coche en cours d'écriture", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t", category: "UI", nagInterval: 60 })]));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { notifier } = fakeNotifier(() => gate);
    const check = checkFromWidget({ taskId: "t", stepId: null }, notifier);
    await new Promise((r) => setTimeout(r, 20)); // la coche a lu les données, l'écriture est en attente
    // L'app s'ouvre pendant ce temps
    const { result } = await renderHook(() => useTasks());
    await act(async () => {
      release();
      await check;
    });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.tasks[0].isDone).toBe(true);
  });
});

describe("2. double appui rapide", () => {
  it("une coche à la fois : la seconde trouve la tâche terminée ; aucun rappel en double", async () => {
    const dueAt = Date.now() + DAY;
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([makeTask({ id: "r", category: "INU", dueAt, reminderOffset: 60, recurrence: { freq: "daily", hour: 9, minute: 0 } })])
    );
    const { notifier, active } = fakeNotifier(() => new Promise((r) => setTimeout(r, 10)));
    const results = await Promise.all([
      checkFromWidget({ taskId: "r", stepId: null }, notifier),
      checkFromWidget({ taskId: "r", stepId: null }, notifier),
    ]);
    expect(results.sort()).toEqual(["saved", "unchanged"]);
    const tasks = await stored();
    expect(tasks.map((t) => t.id)).toEqual(["r", `r-next-${dueAt}`]);
    // Rappels programmés = rappels suivis par les tâches (aucun orphelin)
    expect([...active].sort()).toEqual(tasks.flatMap((t) => t.notificationIds).sort());
    expect(JSON.parse((await AsyncStorage.getItem(COMPLETION_LOG_KEY))!).entries).toHaveLength(1);
  });
});

describe("3. données dans un ancien format", () => {
  it("copie brute gardée avant que la version migrée la remplace", async () => {
    // Format v7 (avant progress), jamais rouvert par la 1.6
    const v7 = JSON.stringify({ schemaVersion: 7, tasks: [{ ...makeTask({ id: "t", category: "UI" }), progress: undefined }] });
    await AsyncStorage.setItem(STORAGE_KEY, v7);
    expect(await checkFromWidget({ taskId: "t", stepId: null }, fakeNotifier().notifier)).toBe("saved");
    expect(await AsyncStorage.getItem(backupKeyFor(7))).toBe(v7);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!).schemaVersion).toBe(8);
  });

  it("contenu illisible : rien n'est écrit", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{abîmé");
    await expect(checkFromWidget({ taskId: "t", stepId: null }, fakeNotifier().notifier)).rejects.toThrow();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe("{abîmé");
  });
});

describe("4. une seule écriture", () => {
  it("tâches, journal et suppressions écrits ensemble (multiSet), jamais séparément", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t", category: "UI" })]));
    const multiSet = jest.spyOn(AsyncStorage, "multiSet");
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    multiSet.mockClear();
    setItem.mockClear();
    await checkFromWidget({ taskId: "t", stepId: null }, fakeNotifier().notifier);
    expect(multiSet).toHaveBeenCalledTimes(1);
    expect(multiSet.mock.calls[0][0].map(([key]) => key)).toEqual([STORAGE_KEY, COMPLETION_LOG_KEY, TOMBSTONES_KEY]);
    const written = setItem.mock.calls.map(([key]) => key);
    expect(written).not.toContain(STORAGE_KEY);
    expect(written).not.toContain(COMPLETION_LOG_KEY);
  });
});
