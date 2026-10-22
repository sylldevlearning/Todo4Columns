import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import {
  CATEGORY_ID,
  CHANNEL_ID,
  MAX_SCHEDULED,
  reconcileNotifications,
  syncTaskNotifications,
} from "../notifications/service";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

// Simulation (voir jest/expo-notifications-mock.js)
const mock = Notifications as unknown as {
  __state: {
    scheduled: { identifier: string; content: any; trigger: any }[];
    permission: string;
  };
};
const scheduled = () => mock.__state.scheduled;

const MIN = 60 * 1000;
const NOW = new Date(2026, 9, 22, 10).getTime();
const NO_QUIET: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00" };

describe("syncTaskNotifications", () => {
  const task = makeTask({
    id: "a",
    title: "Appeler",
    category: "UI",
    updatedAt: NOW,
    nagInterval: 30,
    nagRepeat: true,
  });

  it("programme les notifications de computeSchedule avec un déclencheur date", async () => {
    const ids = await syncTaskNotifications(task, NO_QUIET, NOW);

    expect(ids).toHaveLength(3);
    expect(scheduled()[0]).toMatchObject({
      content: {
        title: "Appeler",
        body: "Toujours pas faite ? Relance 1/3",
        data: { taskId: "a", type: "nag", date: NOW + 30 * MIN },
        categoryIdentifier: CATEGORY_ID,
      },
      trigger: { type: "date", date: NOW + 30 * MIN, channelId: CHANNEL_ID },
    });
  });

  it("annule les anciens identifiants avant de reprogrammer", async () => {
    const ids = await syncTaskNotifications(task, NO_QUIET, NOW);
    const again = await syncTaskNotifications({ ...task, notificationIds: ids }, NO_QUIET, NOW);

    expect(scheduled().map((n) => n.identifier)).toEqual(again);
    expect(again.some((id) => ids.includes(id))).toBe(false);
  });

  it("ne programme rien sans autorisation, mais annule l'existant", async () => {
    const ids = await syncTaskNotifications(task, NO_QUIET, NOW);
    mock.__state.permission = "denied";

    expect(await syncTaskNotifications({ ...task, notificationIds: ids }, NO_QUIET, NOW)).toEqual([]);
    expect(scheduled()).toHaveLength(0);
  });

  it("respecte la limite de 64 notifications programmées", async () => {
    for (let i = 0; i < MAX_SCHEDULED - 1; i++) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "autre" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: NOW + MIN },
      });
    }
    const ids = await syncTaskNotifications(task, NO_QUIET, NOW);
    expect(ids).toHaveLength(1);
    expect(scheduled()).toHaveLength(MAX_SCHEDULED);
  });
});

describe("reconcileNotifications", () => {
  it("annule les orphelines, garde les bonnes et programme celles qui manquent", async () => {
    const a = makeTask({ id: "a", category: "UI", updatedAt: NOW, nagInterval: 30 });
    const b = makeTask({ id: "b", category: "UI", updatedAt: NOW, nagInterval: 60 });
    const [keptId] = await syncTaskNotifications(a, NO_QUIET, NOW);
    // Orpheline : tâche supprimée
    await syncTaskNotifications(makeTask({ id: "gone", category: "UI", updatedAt: NOW, nagInterval: 45 }), NO_QUIET, NOW);
    // Sans données : programmée par autre chose
    await Notifications.scheduleNotificationAsync({
      content: { title: "inconnue" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: NOW + MIN },
    });

    const result = await reconcileNotifications([a, b], NO_QUIET, NOW);

    expect(result.a).toEqual([keptId]);
    expect(result.b).toHaveLength(1);
    expect(scheduled().map((n) => n.content.data?.taskId).sort()).toEqual(["a", "b"]);
  });

  it("garde les 64 plus proches quand il y en a trop", async () => {
    const tasks = Array.from({ length: 70 }, (_, i) =>
      makeTask({ id: `t${i}`, category: "UI", updatedAt: NOW, nagInterval: i + 1 })
    );
    const result = await reconcileNotifications(tasks, NO_QUIET, NOW);

    expect(scheduled()).toHaveLength(MAX_SCHEDULED);
    expect(result.t0).toHaveLength(1);
    expect(result.t69).toEqual([]); // la plus lointaine attend la prochaine ouverture
  });
});

describe("synchronisation dans useTasks", () => {
  beforeEach(() => AsyncStorage.clear());

  const setup = async () => {
    const hook = await renderHook(() => useTasks(NO_QUIET));
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull());
    return hook;
  };

  const taskIdsScheduled = () => scheduled().map((n) => n.content.data?.taskId);

  it("programme à l'ajout et enregistre les identifiants dans la tâche", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Appeler", category: "UI", nagInterval: 30 }));

    await waitFor(() => expect(result.current.tasks[0].notificationIds).toHaveLength(1));
    expect(scheduled().map((n) => n.identifier)).toEqual(result.current.tasks[0].notificationIds);
  });

  it("annule à la coche et reprogramme à la décoche", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Appeler", category: "UI", nagInterval: 30 }));
    await waitFor(() => expect(scheduled()).toHaveLength(1));
    const id = result.current.tasks[0].id;

    await act(() => result.current.toggleDone(id));
    await waitFor(() => expect(scheduled()).toHaveLength(0));
    expect(result.current.tasks[0].notificationIds).toEqual([]);

    await act(() => result.current.toggleDone(id));
    await waitFor(() => expect(scheduled()).toHaveLength(1));
  });

  it("reprogramme au déplacement et à la modification", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Rapport", category: "UI", nagInterval: 30 }));
    await waitFor(() => expect(scheduled()).toHaveLength(1));
    const id = result.current.tasks[0].id;

    await act(() => result.current.moveTask(id, "NDNI"));
    await waitFor(() => expect(scheduled()).toHaveLength(0));

    await act(() =>
      result.current.updateTask(id, {
        category: "INU",
        dueAt: Date.now() + 3 * 24 * 60 * MIN,
        reminderOffset: 60,
      })
    );
    await waitFor(() =>
      expect(scheduled().map((n) => n.content.data?.type)).toEqual(["reminder", "due"])
    );
  });

  it("annule à la suppression et reprogramme à l'annulation", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Appeler", category: "UI", nagInterval: 30 }));
    await waitFor(() => expect(scheduled()).toHaveLength(1));

    let removed: ReturnType<typeof result.current.removeTask> = [];
    await act(() => {
      removed = result.current.removeTask(result.current.tasks[0].id);
    });
    await waitFor(() => expect(scheduled()).toHaveLength(0));

    await act(() => result.current.restoreTasks(removed));
    await waitFor(() => expect(scheduled()).toHaveLength(1));
    expect(result.current.tasks[0].notificationIds).toEqual([scheduled()[0].identifier]);
  });

  it("réconcilie au démarrage : orphelines annulées, manquantes programmées", async () => {
    const future = Date.now();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "keep", category: "UI", updatedAt: future, nagInterval: 30, notificationIds: ["perdue"] }),
      ])
    );
    await syncTaskNotifications(
      makeTask({ id: "supprimee", category: "UI", updatedAt: future, nagInterval: 30 }),
      NO_QUIET
    );

    const { result } = await renderHook(() => useTasks(NO_QUIET));

    await waitFor(() => expect(taskIdsScheduled()).toEqual(["keep"]));
    await waitFor(() =>
      expect(result.current.tasks[0].notificationIds).toEqual([scheduled()[0].identifier])
    );
  });
});
