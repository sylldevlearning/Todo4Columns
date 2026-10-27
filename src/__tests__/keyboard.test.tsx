import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import React from "react";
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TaskSheet from "../../app/task";
import { FOCUS_MARGIN } from "../hooks/useFocusedFieldScroll";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { TasksProvider } from "../store/TasksContext";
import { METRICS } from "../testing/metrics";

jest.setTimeout(20000);

type Listener = (e: { endCoordinates: { height: number } }) => void;
let listeners: Record<string, Listener[]> = {};
const emit = (event: string, height = 0) =>
  act(async () => listeners[event]?.forEach((l) => l({ endCoordinates: { height } })));

const Layout = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <TasksProvider>
      <Slot />
    </TasksProvider>
  </SafeAreaProvider>
);
const Empty = () => null;

// Champ qui a le focus, à 900 px du haut du contenu de la fiche
const focused = (y: number | null) =>
  jest
    .spyOn(TextInput.State, "currentlyFocusedInput")
    .mockReturnValue(
      (y === null ? null : { measureLayout: (_: unknown, ok: (x: number, y: number) => void) => ok(0, y) }) as never
    );

const scrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;

describe("fiche longue et clavier (Android)", () => {
  let os: jest.ReplaceProperty<typeof Platform.OS>;
  beforeEach(async () => {
    await AsyncStorage.clear();
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
    os = jest.replaceProperty(Platform, "OS", "android");
    listeners = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, l: Listener) => {
      (listeners[event] ??= []).push(l);
      return { remove: () => (listeners[event] = listeners[event].filter((x) => x !== l)) };
    }) as never);
    scrollTo.mockClear();
    await renderRouter({ _layout: Layout, index: Empty, task: TaskSheet }, { initialUrl: "/" });
    await act(() => router.push("/task?category=INU"));
  });
  afterEach(() => os.restore());

  const paddingBottom = () =>
    StyleSheet.flatten(screen.getByTestId("task-sheet").props.contentContainerStyle).paddingBottom as number;

  it("le champ qui reçoit le focus défile au-dessus du clavier ; la fiche garde la place du clavier", async () => {
    const before = paddingBottom();
    focused(900);
    await emit("keyboardDidShow", 320);
    expect(paddingBottom()).toBe(before + 320);
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 900 - FOCUS_MARGIN, animated: true }));

    // Autre champ touché, clavier déjà ouvert (« Nouvelle étape », plus bas)
    scrollTo.mockClear();
    focused(1400);
    await fireEvent(screen.getByLabelText("Nouvelle étape"), "touchEnd");
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ y: 1400 - FOCUS_MARGIN, animated: true }));

    await emit("keyboardDidHide");
    expect(paddingBottom()).toBe(before);
  });

  it("sans champ ayant le focus : rien ne défile", async () => {
    focused(null);
    await emit("keyboardDidShow", 320);
    await act(() => jest.advanceTimersByTimeAsync(100));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
