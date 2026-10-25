import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HelpScreen from "../../app/help";
import SettingsScreen from "../../app/settings";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

function Layout() {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Slot />
      </TasksProvider>
    </SafeAreaProvider>
  );
}

describe("page « Comment ça marche »", () => {
  beforeEach(() => AsyncStorage.clear());

  it("s'ouvre depuis les Réglages et explique la méthode, les 4 cases et les gestes", async () => {
    await renderRouter(
      { _layout: Layout, settings: SettingsScreen, help: HelpScreen },
      { initialUrl: "/settings" }
    );
    await act(async () => {});

    await fireEvent.press(await screen.findByRole("button", { name: "Comment ça marche" }));
    expect(await screen.findByRole("header", { name: "La méthode d'Eisenhower" })).toBeOnTheScreen();

    for (const paragraph of fr.howTo.method) expect(screen.getByText(paragraph)).toBeOnTheScreen();
    for (const name of ["Faire", "Planifier", "Déléguer", "Si j'ai le temps"]) {
      expect(screen.getByRole("header", { name })).toBeOnTheScreen();
    }
    for (const { action, examples } of Object.values(fr.howTo.quadrants)) {
      expect(screen.getByText(action)).toBeOnTheScreen();
      for (const example of examples) expect(screen.getByText(`• ${example}`)).toBeOnTheScreen();
    }
    expect(screen.getByRole("header", { name: "Ta semaine" })).toBeOnTheScreen();
    for (const paragraph of fr.howTo.week) expect(screen.getByText(paragraph)).toBeOnTheScreen();
    for (const gesture of Object.values(fr.howTo.gestures)) {
      expect(screen.getByText(gesture)).toBeOnTheScreen();
    }
  });

  it("textes en français et en anglais : 3 exemples par case et les mêmes gestes", () => {
    for (const lang of [fr, en]) {
      expect(lang.howTo.method.length).toBeGreaterThan(0);
      for (const { examples } of Object.values(lang.howTo.quadrants)) {
        expect(examples).toHaveLength(3);
      }
    }
    expect(Object.keys(en.howTo.gestures)).toEqual(Object.keys(fr.howTo.gestures));
    expect(en.howTo.title).toBe("How it works");
  });
});
