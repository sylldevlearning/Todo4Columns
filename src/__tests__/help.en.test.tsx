import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HelpScreen from "../../app/help";
import InfoButton from "../components/InfoButton";
import { FirstLaunchOnboarding } from "../components/Onboarding";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

// Téléphone en anglais
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
}));

const wrap = (ui: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <TasksProvider>{ui}</TasksProvider>
  </SafeAreaProvider>
);

describe("aide en anglais", () => {
  beforeEach(() => AsyncStorage.clear());

  it("présentation", async () => {
    await render(wrap(<FirstLaunchOnboarding />));
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByRole("header", { name: "Urgent or important?" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Screen 1 of 3")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Two questions, that's all")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByText("Urgent or important?")).toBeNull();
  });

  it("carte d'info", async () => {
    await render(wrap(<InfoButton info="important" />));
    await fireEvent.press(screen.getByLabelText("Learn more: Is it important?"));
    expect(screen.getByRole("header", { name: "Is it important?" })).toBeOnTheScreen();
    expect(screen.getByText(/^Example: preparing for a job interview/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/^Example:/)).toBeNull();
  });

  it("page « How it works »", async () => {
    await render(wrap(<HelpScreen />));
    expect(screen.getByRole("header", { name: "The Eisenhower method" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Someday" })).toBeOnTheScreen();
    expect(screen.getByText("Swipe a task right to complete it.")).toBeOnTheScreen();
  });
});
