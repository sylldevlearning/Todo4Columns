import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import React, { Profiler } from "react";
import { AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import BalanceScreen from "../../app/balance";
import ReviewScreen from "../../app/review";
import { COMPLETION_LOG_KEY } from "../completionLog";
import { SAVE_DELAY_MS, useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { DEFAULT_SETTINGS, SETTINGS_KEY, Settings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, useTaskActions } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00", weeklyReview: false };
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
const writesTo = (spy: jest.SpyInstance, key: string) => spy.mock.calls.filter(([k]) => k === key);

// AppState simulé : on garde les écouteurs pour passer en arrière-plan et revenir
let listeners: ((state: AppStateStatus) => void)[] = [];
const setAppState = (state: AppStateStatus) =>
  Object.defineProperty(AppState, "currentState", { value: state, configurable: true });
const emit = (state: AppStateStatus) =>
  act(async () => {
    setAppState(state);
    listeners.forEach((l) => l(state));
  });

beforeEach(async () => {
  await AsyncStorage.clear();
  listeners = [];
  setAppState("active");
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, l: (s: AppStateStatus) => void) => {
    listeners.push(l);
    return { remove: () => (listeners = listeners.filter((x) => x !== l)) };
  }) as never);
});

afterEach(() => {
  setAppState("active");
  // Déjà un mock dans Jest : on remet un abonnement neutre plutôt que mockRestore
  (AppState.addEventListener as jest.Mock).mockImplementation((() => ({ remove: jest.fn() })) as never);
});

describe("bascule à l'échéance", () => {
  // Comportement seulement ; le comptage des minuteries est vérifié plus bas
  it("pas de bascule en arrière-plan ; vérification au retour dans l'app", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([makeTask({ id: "p", category: "INU", dueAt: Date.now() + 300 })])
    );
    const { result, unmount } = await renderHook(() => useTasks(SETTINGS));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await emit("background");
    await wait(600);
    // L'échéance est passée pendant l'arrière-plan : la minuterie était arrêtée, rien n'a basculé
    expect(result.current.tasks[0].category).toBe("INU");

    await emit("active");
    await waitFor(() => expect(result.current.tasks[0].category).toBe("UI"));
    await unmount();
  });
});

describe("aucune minuterie en arrière-plan", () => {
  afterEach(() => jest.useRealTimers());

  it("ni pour l'échéance suivante (bascule), ni pour la fin d'un minuteur", async () => {
    // Minuteries simulées dès le départ : on peut compter celles qui restent programmées
    jest.useFakeTimers();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "p", category: "INU", dueAt: Date.now() + 60 * 60 * 1000 }),
        makeTask({ id: "m", category: "UI", timerEnd: Date.now() + 30 * 60 * 1000 }),
      ])
    );
    const { result, unmount } = await renderHook(() => useTasks(SETTINGS));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAVE_DELAY_MS + 100);
    });
    // À l'écran : la minuterie de l'échéance et celle du minuteur sont programmées
    expect(jest.getTimerCount()).toBeGreaterThanOrEqual(2);

    // Laisse React appliquer le changement d'état (effets et nettoyages)
    const settle = () => act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    await emit("background");
    await settle();
    expect(jest.getTimerCount()).toBe(0);

    // Retour : les deux minuteries reprennent
    await emit("active");
    await settle();
    expect(jest.getTimerCount()).toBeGreaterThanOrEqual(2);
    await unmount();
  });
});

describe("écritures regroupées", () => {
  it("journal : plusieurs tâches terminées à la suite, une seule écriture", async () => {
    const { result } = await renderHook(() => useTasks(SETTINGS));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    // Journal lu (et créé) avant de compter les écritures
    await waitFor(async () => expect(await AsyncStorage.getItem(COMPLETION_LOG_KEY)).not.toBeNull());
    await wait(SAVE_DELAY_MS + 100);
    for (const title of ["Un", "Deux", "Trois"]) {
      await act(() => result.current.addTask({ title, category: "UI" }));
    }
    await wait(SAVE_DELAY_MS + 100);
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    // Déjà un jest.fn dans le mock d'AsyncStorage : on oublie les écritures précédentes
    setItem.mockClear();

    for (const task of result.current.tasks) await act(() => result.current.toggleDone(task.id));
    expect(writesTo(setItem, COMPLETION_LOG_KEY)).toHaveLength(0);
    await wait(SAVE_DELAY_MS + 100);
    const writes = writesTo(setItem, COMPLETION_LOG_KEY);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1] as string).entries).toHaveLength(3);
  });

  it("journal : écrit tout de suite quand l'app passe en arrière-plan", async () => {
    const { result } = await renderHook(() => useTasks(SETTINGS));
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    // Journal lu (et créé) avant de compter les écritures
    await waitFor(async () => expect(await AsyncStorage.getItem(COMPLETION_LOG_KEY)).not.toBeNull());
    await wait(SAVE_DELAY_MS + 100);
    await act(() => result.current.addTask({ title: "Un", category: "UI" }));
    await wait(SAVE_DELAY_MS + 100);
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    // Déjà un jest.fn dans le mock d'AsyncStorage : on oublie les écritures précédentes
    setItem.mockClear();

    await act(() => result.current.toggleDone(result.current.tasks[0].id));
    await emit("background");
    expect(writesTo(setItem, COMPLETION_LOG_KEY)).toHaveLength(1);
  });

  it("réglages : plusieurs changements à la suite, une seule écriture ; immédiate en arrière-plan", async () => {
    let actions: TaskActions;
    const Grab = () => {
      actions = useTaskActions();
      return null;
    };
    await render(
      <TasksProvider>
        <Grab />
      </TasksProvider>
    );
    await act(async () => {});
    await act(async () => {});
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    // Déjà un jest.fn dans le mock d'AsyncStorage : on oublie les écritures précédentes
    setItem.mockClear();

    for (const time of ["17:00", "17:15", "17:30"]) {
      await act(() => actions.updateSettings({ ...actions.getSettings(), weeklyReviewTime: time }));
    }
    expect(writesTo(setItem, SETTINGS_KEY)).toHaveLength(0);
    await wait(SAVE_DELAY_MS + 100);
    const writes = writesTo(setItem, SETTINGS_KEY);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1] as string).settings.weeklyReviewTime).toBe("17:30");

    await act(() => actions.updateSettings({ ...actions.getSettings(), celebrations: false }));
    await emit("background");
    expect(writesTo(setItem, SETTINGS_KEY)).toHaveLength(2);
  });
});

describe("écrans Bilan et Revue : pas de rendus inutiles", () => {
  it("une tâche terminée ou un réglage modifié ne re-rend pas la revue en cours ; le bilan seulement quand le journal change", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "n", title: "Idée", category: "NDNI" }),
        makeTask({ id: "f", title: "Appeler", category: "UI" }),
      ])
    );
    const renders: Record<string, number> = { review: 0, balance: 0 };
    const count = (id: string) => (renders[id] += 1);
    let actions: TaskActions;
    const Grab = () => {
      actions = useTaskActions();
      return null;
    };
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Profiler id="review" onRender={count}>
            <ReviewScreen />
          </Profiler>
          <Profiler id="balance" onRender={count}>
            <BalanceScreen />
          </Profiler>
          <Grab />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await act(async () => {});
    await act(async () => {});
    renders.review = renders.balance = 0;

    // Réglage modifié : aucun des deux écrans ne l'affiche
    await act(() => actions.updateSettings({ ...actions.getSettings(), celebrations: false }));
    expect(renders).toEqual({ review: 0, balance: 0 });

    // Tâche ajoutée hors des listes de la revue : rien
    await act(() => actions.addTask({ title: "Autre", category: "UI" }));
    expect(renders).toEqual({ review: 0, balance: 0 });

    // Tâche « Faire » terminée : le journal change, seul le bilan se met à jour
    await act(() => actions.toggleDone("f"));

    expect(renders.review).toBe(0);
    expect(renders.balance).toBeGreaterThan(0);
  });
});
