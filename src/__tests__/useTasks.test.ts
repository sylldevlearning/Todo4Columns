import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useTasks } from "../hooks/useTasks";
import { STORAGE_KEY } from "../storage";

// Contenu enregistré sous TASKS_4COLS
const stored = async () => {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json === null ? null : JSON.parse(json);
};

// Monte le hook et attend la fin du chargement initial
const setup = async () => {
  const hook = await renderHook(() => useTasks());
  await waitFor(async () => expect(await stored()).not.toBeNull());
  return hook;
};

describe("useTasks", () => {
  beforeEach(() => AsyncStorage.clear());

  it("ajoute une tâche avec les valeurs par défaut", async () => {
    const { result } = await setup();

    await act(() => result.current.addTask("Acheter du pain", "INU"));

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]).toMatchObject({
      title: "Acheter du pain",
      category: "INU",
      isDone: false,
      timerEnd: null,
      dueAt: null,
      reminderOffset: null,
      nagInterval: null,
      nagRepeat: false,
      notificationIds: [],
    });
    expect(result.current.tasks[0].createdAt).toBe(
      result.current.tasks[0].updatedAt
    );
  });

  it("coche puis décoche une tâche", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask("Tâche", "UI"));
    const id = result.current.tasks[0].id;

    await act(() => result.current.toggleDone(id));
    expect(result.current.tasks[0].isDone).toBe(true);

    await act(() => result.current.toggleDone(id));
    expect(result.current.tasks[0].isDone).toBe(false);
  });

  it("supprime une tâche", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask("À garder", "UI"));
    await act(() => result.current.addTask("À supprimer", "NDNI"));
    const toRemove = result.current.tasks.find((t) => t.title === "À supprimer")!;

    await act(() => result.current.removeTask(toRemove.id));

    expect(result.current.tasks.map((t) => t.title)).toEqual(["À garder"]);
  });

  it("enregistre les tâches au format v2 et les retrouve au redémarrage", async () => {
    const first = await setup();
    await act(() => first.result.current.addTask("Persistante", "UDI"));

    await waitFor(async () => {
      const data = await stored();
      expect(data.schemaVersion).toBe(2);
      expect(data.tasks).toHaveLength(1);
    });
    await first.unmount();

    const second = await renderHook(() => useTasks());
    await waitFor(() =>
      expect(second.result.current.tasks.map((t) => t.title)).toEqual([
        "Persistante",
      ])
    );
  });

  it("charge et migre les tâches de l'ancien format", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1717000000000", title: "Ancienne", category: "NDNI", isDone: true, timerEnd: null },
      ])
    );

    const { result } = await renderHook(() => useTasks());

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0]).toMatchObject({
      title: "Ancienne",
      category: "NDNI",
      isDone: true,
      createdAt: 1717000000000,
    });
    await waitFor(async () => expect((await stored()).schemaVersion).toBe(2));
  });

  it("ne sauvegarde rien si la lecture échoue", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "[]");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("disque"));
    (AsyncStorage.setItem as jest.Mock).mockClear();

    const { result } = await renderHook(() => useTasks());
    await act(() => result.current.addTask("Non sauvegardée", "UI"));

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe("[]");
  });
});
