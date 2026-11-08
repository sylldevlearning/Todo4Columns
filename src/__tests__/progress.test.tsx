import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot } from "expo-router";
import { render } from "@testing-library/react-native";
import { act, fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import React from "react";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { SafeAreaProvider } from "react-native-safe-area-context";
import QuadrantScreen from "../../app/quadrant/[category]";
import { buildBackup, parseBackup } from "../backup";
import { CelebrationProvider } from "../celebration/CelebrationProvider";
import TaskForm from "../components/TaskForm";
import { serializeTasks } from "../migrations";
import { isAutoProgress, parseProgress, PROGRESS_VALUES, taskProgress } from "../progress";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TasksProvider, TasksState, useSettingsSelector, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";
import { TaskStep } from "../types";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));
jest.setTimeout(20000);

const step = (id: string, title: string, done = false): TaskStep => ({ id, title, done, doneAt: done ? 1 : null, day: null, time: null });

describe("calcul de l'avancement", () => {
  it("avec étapes : étapes faites / total ; sans étapes : valeur réglée, ou rien", () => {
    expect(taskProgress({ steps: [step("a", "A", true), step("b", "B"), step("c", "C")], progress: 90 })).toBe(33);
    expect(taskProgress({ steps: [step("a", "A", true)], progress: null })).toBe(100);
    expect(taskProgress({ steps: [], progress: 40 })).toBe(40);
    expect(taskProgress({ steps: [], progress: null })).toBeNull();
    expect(taskProgress({})).toBeNull();
    expect(isAutoProgress({ steps: [step("a", "A")] })).toBe(true);
    expect(isAutoProgress({ steps: [] })).toBe(false);
  });

  it("0 à 100 par pas de 10", () => {
    expect(PROGRESS_VALUES).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect([parseProgress(44), parseProgress(-5), parseProgress(130), parseProgress("50"), parseProgress(NaN)]).toEqual([40, 0, 100, null, null]);
  });
});

describe("schéma v8", () => {
  beforeEach(() => AsyncStorage.clear());

  it("format v7 : copie TASKS_4COLS_BACKUP_V7 avant la migration, avancement null", async () => {
    const v7 = JSON.stringify({ schemaVersion: 7, tasks: [{ id: "a", title: "Exposé", category: "INU", isDone: false, createdAt: 1, updatedAt: 1, steps: [] }] });
    await AsyncStorage.setItem(STORAGE_KEY, v7);
    const { loadTasks } = require("../storage");
    const tasks = await loadTasks();
    expect(tasks[0].progress).toBeNull();
    expect(await AsyncStorage.getItem("TASKS_4COLS_BACKUP_V7")).toBe(v7);
  });

  it("sauvegarde et import gardent l'avancement", () => {
    const file = buildBackup(
      { tasks: [makeTask({ id: "a", title: "Rapport", category: "INU", progress: 70 })], settings: DEFAULT_SETTINGS, completions: [], reviewWeeks: [] },
      1
    );
    expect((file.tasks as { schemaVersion: number }).schemaVersion).toBe(8);
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.ok && parsed.backup.tasks[0].progress).toBe(70);
  });
});

describe("fiche", () => {
  it("sans étapes : avancement réglé à la main et enregistré", async () => {
    const onSubmit = jest.fn();
    await render(<TaskForm task={makeTask({ title: "Rapport", category: "INU", progress: 20 })} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    expect(screen.getByRole("radio", { name: "20 %" })).toBeSelected();
    await fireEvent.press(screen.getByRole("radio", { name: "60 %" }));
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0].progress).toBe(60);
  });

  it("avec étapes : avancement calculé, pas de réglage à la main", async () => {
    await render(
      <TaskForm
        task={makeTask({ title: "Déménagement", category: "INU", steps: [step("a", "Cartons", true), step("b", "Camion"), step("c", "Clés"), step("d", "Ménage")] })}
        settings={DEFAULT_SETTINGS}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByText("Calculé d'après les étapes cochées")).toBeOnTheScreen();
    expect(screen.getByText("25 %")).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "60 %" })).toBeNull();
  });
});

describe("appui long sur une carte", () => {
  function Celebrations({ children }: { children: React.ReactNode }) {
    const enabled = useSettingsSelector((s) => s.celebrations);
    return <CelebrationProvider enabled={enabled}>{children}</CelebrationProvider>;
  }
  let state: TasksState;
  function Grab() {
    state = useTasksSelector((s) => s);
    return null;
  }
  function Layout() {
    return (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Grab />
          <Celebrations>
            <Slot />
          </Celebrations>
        </TasksProvider>
      </SafeAreaProvider>
    );
  }
  const task = (id: string) => state.tasks.find((t) => t.id === id)!;

  const openQuadrant = async () => {
    await AsyncStorage.clear();
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true, weeklyReview: false, celebrations: false });
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "steps", title: "Déménagement", category: "UI", steps: [step("s1", "Cartons"), step("s2", "Camion")] }),
        makeTask({ id: "manual", title: "Rapport", category: "UI", progress: 30 }),
        makeTask({ id: "plain", title: "Appeler", category: "UI" }),
      ])
    );
    await renderRouter({ _layout: Layout, "quadrant/[category]": QuadrantScreen }, { initialUrl: "/quadrant/UI" });
    await screen.findByText("Déménagement");
  };

  it("barre fine sur la carte : avec étapes, ou avancement réglé au-dessus de 0", async () => {
    await openQuadrant();
    const bar = (id: string) => within(screen.getByTestId(`task-card-${id}`)).queryByTestId("progress-bar");
    expect(bar("steps")).toBeOnTheScreen();
    expect(bar("manual")).toHaveProp("accessibilityValue", expect.objectContaining({ now: 30 }));
    expect(bar("plain")).toBeNull();
  });

  it("étapes cochées et décochées en un geste, pourcentage calculé, « Annuler » dans le panneau", async () => {
    await openQuadrant();
    await fireEvent(screen.getByTestId("task-card-steps"), "longPress");
    const panel = screen.getByTestId("quick-panel");
    expect(within(panel).getByText("0 %")).toBeOnTheScreen();

    await fireEvent.press(within(panel).getByRole("checkbox", { name: "Cartons" }));
    expect(task("steps").steps!.map((s) => s.done)).toEqual([true, false]);
    expect(within(panel).getByText("50 %")).toBeOnTheScreen();
    expect(within(panel).getByText("Étape cochée")).toBeOnTheScreen();

    await fireEvent.press(within(panel).getByRole("checkbox", { name: "Cartons" }));
    expect(task("steps").steps![0].done).toBe(false);
    expect(within(panel).getByText("Étape décochée")).toBeOnTheScreen();
    await fireEvent.press(within(panel).getByRole("button", { name: "Annuler" }));
    expect(task("steps").steps![0].done).toBe(true);
    // Pas de réglage à la main quand il y a des étapes
    expect(within(panel).queryByRole("radio")).toBeNull();
  });

  it("sans étapes : pourcentage réglé à la main, « Annuler » rétablit la valeur d'avant", async () => {
    await openQuadrant();
    await fireEvent(screen.getByTestId("task-card-manual"), "longPress");
    const panel = screen.getByTestId("quick-panel");
    expect(within(panel).getByRole("radio", { name: "30 %" })).toBeSelected();
    await fireEvent.press(within(panel).getByRole("radio", { name: "80 %" }));
    expect(task("manual").progress).toBe(80);
    expect(within(panel).getByText("Avancement : 80 %")).toBeOnTheScreen();
    await fireEvent.press(within(panel).getByRole("button", { name: "Annuler" }));
    expect(task("manual").progress).toBe(30);

    await fireEvent.press(within(panel).getByRole("button", { name: "Fermer" }));
    expect(screen.queryByTestId("quick-panel")).toBeNull();
  });

  it("le glissement des cartes marche toujours et n'ouvre pas le panneau", async () => {
    await openQuadrant();
    await act(async () => {
      fireGestureHandler(getByGestureTestId("card-swipe-plain"), [
        { state: State.BEGAN, translationX: 0 },
        { state: State.ACTIVE, translationX: 60 },
        { state: State.ACTIVE, translationX: 130 },
        { state: State.END, translationX: 130 },
      ]);
    });
    await waitFor(() => expect(task("plain").isDone).toBe(true));
    expect(screen.queryByTestId("quick-panel")).toBeNull();
  });

  it("lecteurs d'écran : action « Avancement »", async () => {
    await openQuadrant();
    const card = screen.getByTestId("task-card-manual");
    expect(card).toHaveProp("accessibilityHint", "Appui long : étapes et avancement");
    await fireEvent(card, "accessibilityAction", { nativeEvent: { actionName: "longpress" } });
    expect(screen.getByTestId("quick-panel")).toBeOnTheScreen();
  });
});
