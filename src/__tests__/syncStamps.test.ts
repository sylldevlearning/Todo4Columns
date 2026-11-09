import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { updateLog } from "../completionLog";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { getTombstones, resetTombstonesForTests, TOMBSTONES_KEY } from "../sync/localChanges";
import { EMPTY_SYNC_DATA, modifiedAtOf } from "../sync/merge";
import { makeTask } from "../testing/makeTask";

// Date de modification fiable pour la synchronisation : chaque action de l'utilisateur ou de
// l'app la met à jour, jamais le simple enregistrement des notifications. Les suppressions
// laissent une pierre tombale.

const HOUR = 60 * 60 * 1000;
// Notifications des tâches (sans celle de la revue de la semaine)
const scheduled = () =>
  (Notifications as unknown as { __state: { scheduled: { content: { data: { taskId?: string } } }[] } }).__state
    .scheduled.filter((n) => n.content.data.taskId !== undefined);

const setup = async (tasks = [makeTask({ id: "t", title: "Tâche", category: "UDI", updatedAt: 1000, createdAt: 1000 })]) => {
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
  const hook = await renderHook(() => useTasks());
  await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
  await act(async () => {});
  return hook;
};

let now: number;
beforeEach(async () => {
  await AsyncStorage.clear();
  resetTombstonesForTests();
  now = new Date(2026, 10, 9, 10, 0).getTime();
  jest.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

const task = (r: { current: ReturnType<typeof useTasks> }, id = "t") => r.current.tasks.find((t) => t.id === id)!;

describe("modifiedAt", () => {
  it("le chargement ne change rien ; une ancienne tâche prend sa date connue la plus récente", async () => {
    const { result } = await setup();
    expect(task(result).modifiedAt).toBeUndefined();
    expect(modifiedAtOf(task(result))).toBe(1000);
  });

  it.each([
    ["coche", (r: ReturnType<typeof useTasks>) => r.toggleDone("t")],
    ["modification", (r: ReturnType<typeof useTasks>) => r.updateTask("t", { title: "Nouveau" })],
    ["déplacement", (r: ReturnType<typeof useTasks>) => r.moveTask("t", "NDNI")],
    ["avancement", (r: ReturnType<typeof useTasks>) => r.updateTask("t", { progress: 50 })],
    ["archivage", (r: ReturnType<typeof useTasks>) => r.archiveTask("t")],
    ["priorité de la semaine", (r: ReturnType<typeof useTasks>) => r.setWeekPriorities(["t"], "2026-11-09")],
    ["minuteur", (r: ReturnType<typeof useTasks>) => r.startTimer("t", 25)],
  ])("%s : modifiedAt mis à jour", async (_label, action) => {
    const { result } = await setup();
    now += HOUR;
    await act(async () => action(result.current));
    expect(task(result).modifiedAt).toBe(now);
  });

  it("étape cochée depuis la carte : modifiedAt mis à jour, updatedAt (départ des relances) inchangé", async () => {
    const { result } = await setup([
      makeTask({
        id: "t",
        updatedAt: 1000,
        steps: [{ id: "s1", title: "Étape", done: false, doneAt: null, day: null, time: null }],
      }),
    ]);
    now += HOUR;
    await act(async () => result.current.toggleStep("t", "s1"));
    expect(task(result).modifiedAt).toBe(now);
    expect(task(result).updatedAt).toBe(1000);
  });

  it("enregistrer les identifiants des notifications ne compte pas comme une modification", async () => {
    const { result } = await setup([makeTask({ id: "t", category: "UI", nagInterval: 60, updatedAt: now })]);
    await waitFor(() => expect(task(result).notificationIds.length).toBeGreaterThan(0));
    expect(task(result).modifiedAt).toBeUndefined();
  });

  it("modifiedAt ne déclenche pas de reprogrammation des notifications à lui seul", async () => {
    const { result } = await setup([makeTask({ id: "t", category: "UI", nagInterval: 60, updatedAt: now })]);
    await waitFor(() => expect(scheduled().length).toBeGreaterThan(0));
    const before = task(result).notificationIds;
    now += HOUR;
    await act(async () => result.current.setWeekPriorities(["t"], "2026-11-09"));
    await act(async () => {});
    expect(task(result).notificationIds).toEqual(before);
  });
});

describe("pierres tombales", () => {
  it("suppression : pierre tombale datée et enregistrée ; « Annuler » l'efface et la tâche redevient la plus récente", async () => {
    const { result } = await setup();
    now += HOUR;
    let removed: ReturnType<ReturnType<typeof useTasks>["removeTask"]> = [];
    await act(async () => {
      removed = result.current.removeTask("t");
    });
    expect(getTombstones()).toEqual([{ id: "t", deletedAt: now }]);
    await waitFor(async () => expect(await AsyncStorage.getItem(TOMBSTONES_KEY)).toContain('"deletedAt"'));
    now += 1000;
    await act(async () => result.current.restoreTasks(removed));
    expect(getTombstones()).toEqual([]);
    expect(task(result).modifiedAt).toBe(now);
  });

  it("« Vider les terminées » : une pierre tombale par tâche", async () => {
    const { result } = await setup([
      makeTask({ id: "a", isDone: true, completedAt: 5 }),
      makeTask({ id: "b", isDone: true, completedAt: 6 }),
      makeTask({ id: "c" }),
    ]);
    await act(async () => {
      result.current.clearDone("UI");
    });
    expect(getTombstones().map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("relues au lancement suivant", async () => {
    await AsyncStorage.setItem(TOMBSTONES_KEY, JSON.stringify({ schemaVersion: 1, deleted: [{ id: "x", deletedAt: 7 }] }));
    await setup();
    expect(getTombstones()).toEqual([{ id: "x", deletedAt: 7 }]);
  });
});

describe("données reçues d'une synchronisation", () => {
  it("fusionnées sans être comptées comme des modifications d'ici ; notifications programmées pour les nouvelles tâches", async () => {
    const { result } = await setup([makeTask({ id: "t", updatedAt: 1000 })]);
    const remote = makeTask({ id: "r", title: "Venue d'ailleurs", category: "UI", nagInterval: 60, updatedAt: now, modifiedAt: now - 5 });
    await act(async () => result.current.applySynced({ ...EMPTY_SYNC_DATA, tasks: [remote] }));
    expect(task(result, "r").modifiedAt).toBe(now - 5);
    expect(task(result, "t").modifiedAt).toBeUndefined();
    await waitFor(() => expect(scheduled().some((n) => n.content.data.taskId === "r")).toBe(true));
  });

  it("tâche supprimée ailleurs : retirée ici, ses notifications annulées, sans nouvelle pierre tombale datée d'ici", async () => {
    const { result } = await setup([makeTask({ id: "t", category: "UI", nagInterval: 60, updatedAt: now })]);
    await waitFor(() => expect(scheduled().length).toBeGreaterThan(0));
    await act(async () =>
      result.current.applySynced({ ...EMPTY_SYNC_DATA, deleted: [{ id: "t", deletedAt: now + 1 }] })
    );
    expect(result.current.tasks).toEqual([]);
    expect(getTombstones()).toEqual([{ id: "t", deletedAt: now + 1 }]);
    await waitFor(() => expect(scheduled()).toEqual([]));
  });

  it("tâche terminée ailleurs : une seule entrée dans le journal", async () => {
    const { result } = await setup([makeTask({ id: "t", category: "UI", updatedAt: 1000 })]);
    const done = { ...task(result), isDone: true, completedAt: now, modifiedAt: now };
    await act(async () =>
      result.current.applySynced({
        ...EMPTY_SYNC_DATA,
        tasks: [done],
        completions: [{ date: now, category: "UI" }],
      })
    );
    await act(async () => {});
    expect(result.current.completions).toEqual([{ date: now, category: "UI" }]);
  });

  it("« Remplacer » : les tâches d'ici absentes disparaissent", async () => {
    const { result } = await setup([makeTask({ id: "ici" })]);
    await act(async () =>
      result.current.applySynced({ ...EMPTY_SYNC_DATA, tasks: [makeTask({ id: "la-bas" })] }, { replace: true })
    );
    expect(result.current.tasks.map((t) => t.id)).toEqual(["la-bas"]);
  });
});

describe("journal (updateLog)", () => {
  it("n'ajoute pas une entrée déjà présente, garde deux fins dans la même milliseconde", () => {
    const before = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    const after = before.map((t) => ({ ...t, isDone: true, completedAt: 5 }));
    expect(updateLog([], before, after)).toHaveLength(2);
    expect(updateLog([{ date: 5, category: "UI" }], [before[0]], [after[0]])).toHaveLength(1);
  });
});
