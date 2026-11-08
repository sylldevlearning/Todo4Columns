import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MatrixScreen from "../../app/index";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

describe("matrice : dictée", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockPush.mockClear();
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, remindersPromptDone: true, weeklyReview: false });
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <MatrixScreen />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await act(async () => {});
  });

  it("bouton micro visible à côté du « + » : ouvre la fiche et lance l'écoute", async () => {
    await fireEvent.press(screen.getByRole("button", { name: "Dicter une nouvelle tâche" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/task", params: { voice: "1" } });
  });

  it("appui long sur « + » : même chose ; appui simple : fiche sans dictée", async () => {
    const plus = screen.getByRole("button", { name: "Nouvelle tâche" });
    await fireEvent(plus, "longPress");
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/task", params: { voice: "1" } });
    await fireEvent.press(plus);
    expect(mockPush).toHaveBeenLastCalledWith("/task");
  });
});
