import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import React, { Profiler } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MatrixScreen from "../../app/index";
import QuadrantScreen from "../../app/quadrant/[category]";
import SettingsScreen from "../../app/settings";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, useTaskActions } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";
import { METRICS } from "../testing/metrics";

// Les puces complètes sont rendues par chaque carte non terminée : elles comptent les rendus
// des cartes (la matrice utilise les puces compactes, non comptées)
const chipRenders: string[] = [];
jest.mock("../components/TaskChips", () => ({
  __esModule: true,
  default: ({ task, compact }: { task: Task; compact?: boolean }) => {
    if (!compact) chipRenders.push(task.id);
    return null;
  },
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

// Nombre de rendus de chaque écran (un rendu de n'importe quel composant de l'écran compte)
const renders: Record<string, number> = {};
const count = (id: string) => {
  renders[id] = (renders[id] ?? 0) + 1;
};
const resetCounts = () => {
  for (const id of Object.keys(renders)) renders[id] = 0;
  chipRenders.length = 0;
};

let actions: TaskActions;
function GrabActions() {
  actions = useTaskActions();
  return null;
}

// Quadrant « Faire » (route), Réglages et matrice montés ensemble, comme dans la pile de navigation
function Layout() {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Profiler id="quadrant" onRender={count}>
          <Slot />
        </Profiler>
        <Profiler id="settings" onRender={count}>
          <SettingsScreen />
        </Profiler>
        <Profiler id="matrix" onRender={count}>
          <MatrixScreen />
        </Profiler>
        <GrabActions />
      </TasksProvider>
    </SafeAreaProvider>
  );
}

jest.setTimeout(20000);

const setup = async () => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    serializeTasks([
      makeTask({ id: "a", title: "Appeler le client", category: "UI" }),
      makeTask({ id: "b", title: "Relire le contrat", category: "UI" }),
      makeTask({ id: "c", title: "Préparer le budget", category: "INU" }),
      makeTask({ id: "d", title: "Vieille idée", category: "NDNI", archivedAt: Date.now() - 1000 }),
    ])
  );
  await renderRouter(
    { _layout: Layout, "quadrant/[category]": QuadrantScreen },
    { initialUrl: "/quadrant/UI" }
  );
  await screen.findByLabelText("Marquer « Relire le contrat » comme terminée");
  // Laisse finir les lectures asynchrones (réglages, autorisation des notifications)
  await act(async () => {});
  await act(async () => {});
  resetCounts();
};

describe("rendus après la séparation du contexte", () => {
  beforeEach(() => AsyncStorage.clear());

  it("un changement de réglage ne re-rend ni les listes ni la matrice", async () => {
    await setup();

    await act(() => actions.updateSettings({ ...actions.getSettings(), celebrations: false }));
    await act(() => actions.updateSettings({ ...actions.getSettings(), autoArchive: false }));

    expect(actions.getSettings().celebrations).toBe(false);
    expect(renders.settings).toBeGreaterThan(0); // l'écran Réglages, lui, affiche le réglage
    expect(renders.quadrant).toBe(0);
    expect(renders.matrix).toBe(0);
    expect(chipRenders).toEqual([]);
  });

  it("une coche ne re-rend pas les écrans qui n'affichent pas cette tâche", async () => {
    await setup();

    // Tâche de « Planifier » : ni le quadrant « Faire » ni les Réglages ne l'affichent
    await act(() => actions.toggleDone("c"));
    expect(renders.matrix).toBeGreaterThan(0); // la matrice affiche les tâches à faire
    expect(renders.quadrant).toBe(0);
    expect(renders.settings).toBe(0);

    // Tâche de « Faire » : seule sa carte est re-rendue dans le quadrant
    resetCounts();
    await act(() => actions.snoozeTask("a"));
    expect(renders.quadrant).toBeGreaterThan(0);
    expect(chipRenders).toEqual(["a"]);
    expect(renders.settings).toBe(0);
  });

  it("les actions gardent la même identité d'un rendu à l'autre", async () => {
    await setup();
    const before = actions;
    await act(() => actions.toggleDone("a"));
    await act(() => actions.updateSettings({ ...actions.getSettings(), maxNags: 5 }));
    expect(actions).toBe(before);
  });
});
