import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import QuadrantScreen from "../../app/quadrant/[category]";
import { useStableCallback } from "../hooks/useStableCallback";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { TasksProvider } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";

// Les puces sont rendues par chaque carte non terminée : elles comptent les rendus des cartes
const chipRenders: string[] = [];
jest.mock("../components/TaskChips", () => ({
  __esModule: true,
  default: ({ task }: { task: Task }) => {
    chipRenders.push(task.id);
    return null;
  },
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};

function Layout() {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Slot />
      </TasksProvider>
    </SafeAreaProvider>
  );
}

jest.setTimeout(20000);

describe("rendus de l'écran du quadrant", () => {
  beforeEach(() => AsyncStorage.clear());

  it("cocher une tâche ne re-rend pas les autres cartes", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "a", title: "Appeler", category: "UI" }),
        makeTask({ id: "b", title: "Écrire", category: "UI" }),
        makeTask({ id: "c", title: "Relire", category: "UI" }),
      ])
    );
    await renderRouter(
      { _layout: Layout, "quadrant/[category]": QuadrantScreen },
      { initialUrl: "/quadrant/UI" }
    );
    await screen.findByText("Relire");

    chipRenders.length = 0;
    await fireEvent.press(screen.getByLabelText("Marquer « Appeler » comme terminée"));

    expect(screen.getByText("Tâche terminée")).toBeOnTheScreen();
    expect(chipRenders).not.toContain("b");
    expect(chipRenders).not.toContain("c");
  });
});

describe("useStableCallback", () => {
  it("garde la même identité et appelle la dernière version", async () => {
    const { result, rerender } = await renderHook(
      ({ n }: { n: number }) => useStableCallback((x: number) => x + n),
      { initialProps: { n: 1 } }
    );
    const first = result.current;
    expect(first(1)).toBe(2);

    await rerender({ n: 10 });
    expect(result.current).toBe(first);
    expect(result.current(1)).toBe(11);
  });
});
