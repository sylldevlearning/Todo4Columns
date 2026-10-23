import AsyncStorage from "@react-native-async-storage/async-storage";
import { render } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MatrixScreen from "../../app/index";
import TaskAlerts from "../components/TaskAlerts";
import TaskChips from "../components/TaskChips";
import TaskForm from "../components/TaskForm";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { serializeTasks } from "../migrations";
import { computeSchedule } from "../notifications/schedule";
import { isSoonUrgent, SOON_URGENT_MS } from "../notifications/status";
import { DEFAULT_SETTINGS } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TasksProvider, TasksState, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";

const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 9, 22, 10).getTime();
const planned = (dueAt: number, extra = {}) =>
  makeTask({ id: "p", title: "Rendre le dossier", category: "INU", dueAt, ...extra });

describe("seuil de 48 h", () => {
  it("bientôt urgente quand l'échéance arrive dans moins de 48 h", () => {
    expect(SOON_URGENT_MS).toBe(48 * HOUR);
    expect(isSoonUrgent(planned(NOW + 1 * HOUR), NOW)).toBe(true);
    expect(isSoonUrgent(planned(NOW + 48 * HOUR - 1), NOW)).toBe(true);
    expect(isSoonUrgent(planned(NOW + 48 * HOUR), NOW)).toBe(false);
    expect(isSoonUrgent(planned(NOW + 72 * HOUR), NOW)).toBe(false);
  });

  it("pas pour une échéance passée, une tâche terminée, archivée ou d'un autre quadrant", () => {
    expect(isSoonUrgent(planned(NOW - HOUR), NOW)).toBe(false); // déjà « Passer en Faire »
    expect(isSoonUrgent(planned(NOW + HOUR, { isDone: true }), NOW)).toBe(false);
    expect(isSoonUrgent(planned(NOW + HOUR, { archivedAt: 1 }), NOW)).toBe(false);
    expect(isSoonUrgent(planned(NOW + HOUR, { category: "UI" }), NOW)).toBe(false);
    expect(isSoonUrgent(makeTask({ category: "INU", dueAt: null }), NOW)).toBe(false);
  });

  it("aucune notification en plus : rappel et échéance seulement", () => {
    const task = planned(NOW + 30 * HOUR, { reminderOffset: 60 });
    const settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00" };
    expect(computeSchedule(task, settings, NOW).map((n) => n.type)).toEqual(["reminder", "due"]);
  });
});

describe("carte d'une tâche bientôt urgente", () => {
  it("puce « Bientôt urgente » et bouton « Passer en Faire » avec un « i »", async () => {
    const task = planned(NOW + 5 * HOUR);
    const onMoveToDo = jest.fn();
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <TaskChips task={task} category={CATEGORY_BY_KEY.INU} now={NOW} />
        <TaskAlerts task={task} now={NOW} onSnooze={jest.fn()} onMove={jest.fn()} onMoveToDo={onMoveToDo} />
      </SafeAreaProvider>
    );
    expect(screen.getByText("Bientôt urgente")).toBeOnTheScreen();
    expect(screen.getByLabelText("En savoir plus : Bientôt urgente")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Passer en Faire" }));
    expect(onMoveToDo).toHaveBeenCalledWith("p");
  });

  it("rien à plus de 48 h", async () => {
    const task = planned(NOW + 72 * HOUR);
    await render(
      <>
        <TaskChips task={task} category={CATEGORY_BY_KEY.INU} now={NOW} />
        <TaskAlerts task={task} now={NOW} onSnooze={jest.fn()} onMove={jest.fn()} onMoveToDo={jest.fn()} />
      </>
    );
    expect(screen.queryByText("Bientôt urgente")).toBeNull();
    expect(screen.queryByRole("button", { name: "Passer en Faire" })).toBeNull();
  });
});

describe("bandeau de la matrice", () => {
  const METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 40, left: 0, right: 0, bottom: 20 },
  };
  let state: TasksState;
  function Grab() {
    state = useTasksSelector((s) => s);
    return null;
  }
  const Layout = () => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Slot />
        <Grab />
      </TasksProvider>
    </SafeAreaProvider>
  );
  const launch = async (tasks: ReturnType<typeof makeTask>[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    await renderRouter({ _layout: Layout, index: MatrixScreen }, { initialUrl: "/" });
    await act(async () => {});
    await act(async () => {});
  };

  beforeEach(() => AsyncStorage.clear());

  it("« 2 tâches deviennent urgentes », un appui les liste, « Passer en Faire » en retire une", async () => {
    const now = Date.now();
    await launch([
      makeTask({ id: "a", title: "Rendre le dossier", category: "INU", dueAt: now + 5 * HOUR }),
      makeTask({ id: "b", title: "Payer l'assurance", category: "INU", dueAt: now + 30 * HOUR }),
      makeTask({ id: "c", title: "Réviser l'examen", category: "INU", dueAt: now + 72 * HOUR }),
    ]);
    expect(screen.getByLabelText("En savoir plus : Bientôt urgente")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "2 tâches deviennent urgentes" }));
    expect(screen.getByRole("header", { name: "Bientôt urgentes" })).toBeOnTheScreen();
    // La liste (les titres sont aussi dans la grille)
    expect(screen.getByRole("button", { name: "Passer en Faire : Payer l'assurance" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Passer en Faire : Réviser l'examen" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Passer en Faire : Rendre le dossier" }));
    expect(state.tasks.find((t) => t.id === "a")!.category).toBe("UI");
    expect(screen.getByRole("button", { name: "1 tâche devient urgente" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("header", { name: "Bientôt urgentes" })).toBeNull();
  });

  it("aucun bandeau quand rien ne devient urgent", async () => {
    await launch([makeTask({ id: "c", category: "INU", dueAt: Date.now() + 72 * HOUR })]);
    expect(screen.queryByText(/deviennent? urgentes?/)).toBeNull();
  });
});

describe("suggestion dans la fiche", () => {
  it("échéance dans moins de 48 h et « C'est urgent ? » sur Non : propose de l'activer", async () => {
    const task = planned(Date.now() + 10 * HOUR);
    await render(<TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    expect(screen.getByText("Échéance dans moins de 48 h : c'est sans doute urgent.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Marquer comme urgent" }));
    expect(screen.getByLabelText("C'est urgent ?")).toHaveProp("value", true);
    expect(screen.getByText("→ Faire")).toBeOnTheScreen();
  });

  it("sans bloquer : l'enregistrement reste possible tel quel", async () => {
    const onSubmit = jest.fn();
    await render(<TaskForm task={planned(Date.now() + 10 * HOUR)} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: "INU" }));
  });

  it("pas de suggestion pour une échéance lointaine", async () => {
    await render(
      <TaskForm task={planned(Date.now() + 72 * HOUR)} settings={DEFAULT_SETTINGS} onSubmit={() => {}} />
    );
    expect(screen.queryByText(/c'est sans doute urgent/)).toBeNull();
  });
});
