import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import QuadrantScreen from "../../app/quadrant/[category]";
import { CelebrationProvider } from "../celebration/CelebrationProvider";
import { fr } from "../i18n/fr";
import { serializeTasks } from "../migrations";
import { saveSettings, DEFAULT_SETTINGS } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TasksProvider, useTaskStore } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";

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

// Même organisation que app/_layout.tsx
function Celebrations({ children }: { children: React.ReactNode }) {
  const { settings } = useTaskStore();
  return <CelebrationProvider enabled={settings.celebrations}>{children}</CelebrationProvider>;
}

function Layout() {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Celebrations>
          <Slot />
        </Celebrations>
      </TasksProvider>
    </SafeAreaProvider>
  );
}

// Rendu avec le router : plus lent que les autres tests
jest.setTimeout(20000);

const openQuadrant = async (
  tasks = [makeTask({ id: "a", title: "Appeler le client", category: "UI" })],
  visibleTitle = "Appeler le client"
) => {
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
  await renderRouter(
    { _layout: Layout, "quadrant/[category]": QuadrantScreen },
    { initialUrl: "/quadrant/UI" }
  );
  await screen.findByText(visibleTitle);
};

const celebrationMessage = () => screen.queryByTestId("celebration-message");
const shownMessage = () => fr.celebrations.UI.find((m) => screen.queryByText(m) !== null);

describe("célébration dans l'écran du quadrant", () => {
  beforeEach(() => AsyncStorage.clear());

  it("cocher une tâche : célébration et bandeau « Annuler » visibles ensemble", async () => {
    await openQuadrant();
    await fireEvent.press(screen.getByLabelText("Marquer « Appeler le client » comme terminée"));

    expect(celebrationMessage()).toBeOnTheScreen();
    expect(shownMessage()).toBeDefined();
    expect(screen.getByText("Tâche terminée")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeOnTheScreen();
  });

  it("« Annuler » fait disparaître la célébration et rouvre la tâche", async () => {
    await openQuadrant();
    await fireEvent.press(screen.getByLabelText("Marquer « Appeler le client » comme terminée"));
    expect(celebrationMessage()).toBeOnTheScreen();

    // Le bandeau reste utilisable pendant la célébration
    await fireEvent.press(screen.getByRole("button", { name: "Annuler" }));

    expect(celebrationMessage()).toBeNull();
    expect(screen.queryByText("Tâche terminée")).toBeNull();
    await waitFor(() =>
      expect(screen.getByLabelText("Marquer « Appeler le client » comme terminée")).toBeOnTheScreen()
    );
  });

  it("rouvrir une tâche terminée ne déclenche pas de célébration", async () => {
    await openQuadrant([
      makeTask({ id: "a", title: "Tâche ouverte", category: "UI" }),
      makeTask({ id: "b", title: "Appeler le client", category: "UI", isDone: true }),
    ], "Tâche ouverte");
    await fireEvent.press(await screen.findByText("Terminées · 1"));
    await fireEvent.press(screen.getByLabelText("Marquer « Appeler le client » comme à faire"));

    expect(screen.getByText("Tâche rouverte")).toBeOnTheScreen();
    expect(celebrationMessage()).toBeNull();
  });

  it("option désactivée : aucune célébration", async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, celebrations: false });
    await openQuadrant();
    // Laisse TasksProvider relire les réglages enregistrés
    await act(async () => {});

    await fireEvent.press(screen.getByLabelText("Marquer « Appeler le client » comme terminée"));
    expect(screen.getByText("Tâche terminée")).toBeOnTheScreen();
    expect(celebrationMessage()).toBeNull();
  });
});
