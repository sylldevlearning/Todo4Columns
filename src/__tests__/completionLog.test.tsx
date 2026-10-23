import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MatrixScreen from "../../app/index";
import { addWeeks, startOfWeek } from "../balance";
import {
  COMPLETION_LOG_KEY,
  Completion,
  loadLog,
  pruneLog,
  saveLog,
  updateLog,
} from "../completionLog";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { TasksProvider } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";

const HOUR = 60 * 60 * 1000;

describe("mise à jour du journal", () => {
  const open = makeTask({ id: "a", category: "INU" });
  const done = { ...open, isDone: true, completedAt: 1000 };

  it("une tâche terminée ajoute { date, catégorie }, sans titre", () => {
    const log = updateLog([], [open], [done]);
    expect(log).toEqual([{ date: 1000, category: "INU" }]);
    expect(JSON.stringify(log)).not.toContain(open.title);
  });

  it("une tâche rouverte (« Annuler ») retire son entrée, et seulement la sienne", () => {
    const other: Completion = { date: 999, category: "UI" };
    expect(updateLog([other, { date: 1000, category: "INU" }], [done], [open])).toEqual([other]);
  });

  it("« Annuler » compare la date et la catégorie (deux fins dans la même milliseconde)", () => {
    const ui: Completion = { date: 1000, category: "UI" };
    const inu: Completion = { date: 1000, category: "INU" };
    // La tâche « Planifier » est rouverte : seule son entrée part, celle de « Faire » reste
    expect(updateLog([ui, inu], [done], [open])).toEqual([ui]);
  });

  it("tâche terminée puis déplacée : son entrée part quand même", () => {
    const moved = { ...done, category: "UDI" as const };
    expect(updateLog([{ date: 1000, category: "INU" }], [moved], [{ ...open, category: "UDI" }])).toEqual([]);
  });

  it("supprimer ou restaurer une tâche terminée ne change rien", () => {
    const log: Completion[] = [{ date: 1000, category: "INU" }];
    expect(updateLog(log, [done], [])).toBe(log);
    expect(updateLog(log, [], [done])).toBe(log);
  });
});

describe("limite de 26 semaines", () => {
  it("garde la semaine en cours et les 25 précédentes", () => {
    const now = new Date(2026, 9, 22, 12).getTime();
    const oldest = addWeeks(startOfWeek(now), -25);
    const log: Completion[] = [
      { date: oldest - 1, category: "UI" }, // 27e semaine : retirée
      { date: oldest, category: "INU" },
      { date: now, category: "UDI" },
    ];
    expect(pruneLog(log, now)).toEqual(log.slice(1));
  });

  it("rien à retirer : même journal", () => {
    const log: Completion[] = [{ date: Date.now(), category: "UI" }];
    expect(pruneLog(log, Date.now())).toBe(log);
  });
});

describe("journal dans useTasks", () => {
  beforeEach(() => AsyncStorage.clear());

  const setup = async () => {
    const hook = await renderHook(() => useTasks());
    await waitFor(async () => expect(await AsyncStorage.getItem(COMPLETION_LOG_KEY)).not.toBeNull());
    return hook;
  };

  it("premier lancement : rempli une seule fois avec les tâches terminées datées", async () => {
    const recent = Date.now() - HOUR;
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "a", category: "INU", isDone: true, completedAt: recent }),
        makeTask({ id: "b", category: "UI", isDone: true, completedAt: null }), // date inconnue
        makeTask({ id: "c", category: "UI", isDone: false }),
        makeTask({ id: "d", category: "UDI", isDone: true, completedAt: Date.now() - 400 * 24 * HOUR }), // trop ancienne
      ])
    );
    const { result, unmount } = await setup();
    expect(result.current.completions).toEqual([{ date: recent, category: "INU" }]);
    expect(await loadLog()).toEqual([{ date: recent, category: "INU" }]);
    await unmount();

    // Journal déjà là (vide après des suppressions) : pas de second remplissage
    await saveLog([]);
    const again = await setup();
    await act(async () => {});
    expect(again.result.current.completions).toEqual([]);
  });

  it("ajout à la fin d'une tâche, retrait avec « Annuler »", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Budget", category: "INU" }));
    const id = result.current.tasks[0].id;

    await act(() => result.current.toggleDone(id));
    expect(result.current.completions).toEqual([
      { date: result.current.tasks[0].completedAt, category: "INU" },
    ]);
    await waitFor(async () => expect(await loadLog()).toHaveLength(1));

    await act(() => result.current.toggleDone(id)); // « Annuler »
    expect(result.current.completions).toEqual([]);
    await waitFor(async () => expect(await loadLog()).toEqual([]));
  });

  it("supprimer ou vider les terminées ne change pas le journal", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Un", category: "UI" }));
    await act(() => result.current.addTask({ title: "Deux", category: "UI" }));
    const [one, two] = result.current.tasks.map((t) => t.id);
    await act(() => result.current.toggleDone(one));
    await act(() => result.current.toggleDone(two));

    await act(() => result.current.removeTask(one));
    await act(() => result.current.clearDone("UI"));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.completions).toHaveLength(2);
  });
});

describe("bilan après suppression des tâches", () => {
  it("la carte « Ta semaine » compte encore les tâches supprimées", async () => {
    await AsyncStorage.clear();
    const recent = Date.now() - HOUR;
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([]));
    await saveLog([
      { date: recent, category: "INU" },
      { date: recent - 1, category: "INU" },
      { date: recent - 2, category: "UI" },
    ]);
    const METRICS = {
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 40, left: 0, right: 0, bottom: 20 },
    };
    const Layout = () => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Slot />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await renderRouter({ _layout: Layout, index: MatrixScreen }, { initialUrl: "/" });
    expect(await screen.findByText("2 tâches sur 3 anticipées")).toBeOnTheScreen();
  });
});
