import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

// Écritures de la liste des tâches (les autres clés ne comptent pas)
const taskWrites = () =>
  (AsyncStorage.setItem as jest.Mock).mock.calls.filter(([key]) => key === STORAGE_KEY);
const storedTitles = async () =>
  JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!).tasks.map((t: { title: string }) => t.title);

const setAppState = (state: string) =>
  Object.defineProperty(AppState, "currentState", { value: state, configurable: true });

// Monte le hook sur deux tâches enregistrées, attend la première sauvegarde
const setup = async () => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    serializeTasks([
      makeTask({ id: "a", title: "Appeler", category: "UI" }),
      makeTask({ id: "b", title: "Lire", category: "INU" }),
    ])
  );
  (AsyncStorage.setItem as jest.Mock).mockClear();
  const hook = await renderHook(() => useTasks());
  await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
  await waitFor(() => expect(taskWrites()).toHaveLength(1));
  (AsyncStorage.setItem as jest.Mock).mockClear();
  return hook;
};

describe("sauvegarde des tâches", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setAppState("active");
  });
  afterEach(() => {
    setAppState("active");
    jest.restoreAllMocks();
  });

  it("une rafale de modifications donne une seule écriture, avec tout son contenu", async () => {
    const { result } = await setup();

    await act(() => {
      result.current.toggleDone("a");
      result.current.toggleDone("b");
    });
    await act(() => result.current.addTask({ title: "Nouvelle", category: "UDI" }));
    expect(taskWrites()).toHaveLength(0);

    await waitFor(() => expect(taskWrites()).toHaveLength(1));
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(taskWrites()).toHaveLength(1);
    expect(await storedTitles()).toEqual(["Appeler", "Lire", "Nouvelle"]);
  });

  it("écrit tout de suite ce qui est en attente quand l'app quitte l'écran", async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      listeners.push(handler as (state: AppStateStatus) => void);
      return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
    });
    const { result } = await setup();

    await act(() => result.current.addTask({ title: "Avant la pause", category: "UI" }));
    expect(taskWrites()).toHaveLength(0);

    setAppState("background");
    await act(() => listeners.forEach((listener) => listener("background")));
    expect(taskWrites()).toHaveLength(1);
    expect(await storedTitles()).toContain("Avant la pause");
  });

  it("app en arrière-plan (bouton « Fait » d'une notification) : écriture immédiate", async () => {
    const { result } = await setup();
    setAppState("background");

    await act(() => result.current.completeTask("a"));
    expect(taskWrites()).toHaveLength(1);
  });

  it("rien n'est perdu au démontage", async () => {
    const { result, unmount } = await setup();
    await act(() => result.current.addTask({ title: "Dernière", category: "NDNI" }));
    expect(taskWrites()).toHaveLength(0);

    await unmount();
    expect(taskWrites()).toHaveLength(1);
    expect(await storedTitles()).toContain("Dernière");
  });
});
