import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as Notifications from "expo-notifications";
import React from "react";
import { AppState, AppStateStatus, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TaskSheet from "../../app/task";
import PermissionCard from "../components/PermissionCard";
import { serializeTasks } from "../migrations";
import { hidePermissionCard, isPermissionCardVisible } from "../notifications/permissionCard";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";

const mock = Notifications as unknown as {
  __state: {
    permission: string;
    canAskAgain: boolean;
    requestResult?: string;
    requestCanAskAgain?: boolean;
    scheduled: { content: { data?: { taskId?: string } } }[];
  };
};
const scheduledFor = () => mock.__state.scheduled.map((n) => n.content.data?.taskId);

// AppState simulé pour le retour des réglages du téléphone
let listeners: ((state: AppStateStatus) => void)[] = [];
const emit = (state: AppStateStatus) =>
  act(async () => {
    Object.defineProperty(AppState, "currentState", { value: state, configurable: true });
    listeners.forEach((l) => l(state));
  });

let actions: TaskActions;
let state: TasksState;
function Grab() {
  actions = useTaskActions();
  state = useTasksSelector((s) => s);
  return null;
}
function Layout() {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Slot />
        <PermissionCard />
        <Grab />
      </TasksProvider>
    </SafeAreaProvider>
  );
}
const Empty = () => null;

const launch = async (initialUrl = "/") => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    serializeTasks([makeTask({ id: "a", category: "UI", updatedAt: Date.now(), nagInterval: 30 })])
  );
  await saveSettings({ ...DEFAULT_SETTINGS, weeklyReview: false, onboardingDone: true });
  await renderRouter({ _layout: Layout, index: Empty, task: TaskSheet }, { initialUrl });
  await act(async () => {});
  await act(async () => {});
};

beforeEach(async () => {
  await AsyncStorage.clear();
  hidePermissionCard();
  (Notifications.requestPermissionsAsync as jest.Mock).mockClear();
  listeners = [];
  Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, l: (s: AppStateStatus) => void) => {
    listeners.push(l);
    return { remove: () => (listeners = listeners.filter((x) => x !== l)) };
  }) as never);
  jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined as never);
});

afterEach(() => {
  // Déjà un mock dans Jest : on remet un abonnement neutre plutôt que mockRestore
  (AppState.addEventListener as jest.Mock).mockImplementation((() => ({ remove: jest.fn() })) as never);
});

describe("autorisation des notifications quand un rappel est activé", () => {
  it("pas encore demandée : la fenêtre système s'affiche ; accordée, les rappels sont programmés", async () => {
    mock.__state.permission = "undetermined";
    await launch();
    expect(scheduledFor()).toEqual([]);

    await act(() => actions.requestNotificationPermission());
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(isPermissionCardVisible()).toBe(false);
    await waitFor(() => expect(scheduledFor()).toContain("a"));
  });

  it("pas encore demandée puis refusée dans la fenêtre système : pas de carte en plus", async () => {
    mock.__state.permission = "undetermined";
    mock.__state.requestResult = "denied";
    await launch();
    await act(() => actions.requestNotificationPermission());
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("permission-card")).toBeNull();
  });

  it("refusée une fois mais encore demandable : la fenêtre système s'affiche à nouveau", async () => {
    mock.__state.permission = "denied";
    mock.__state.canAskAgain = true;
    await launch();
    await act(() => actions.requestNotificationPermission());
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("permission-card")).toBeNull();
  });

  it("refusée et Android ne l'affiche plus : carte de l'app, « Ouvrir les réglages » et « Plus tard »", async () => {
    mock.__state.permission = "denied";
    mock.__state.canAskAgain = false;
    await launch();
    await act(() => actions.requestNotificationPermission());
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(
      screen.getByText("Les notifications sont désactivées pour DoFirst. Sans elles, tes rappels n'arriveront pas.")
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ouvrir les réglages" }));
    expect(Linking.openSettings).toHaveBeenCalled();

    await fireEvent.press(screen.getAllByRole("button", { name: "Plus tard" }).at(-1)!);
    expect(screen.queryByTestId("permission-card")).toBeNull();
  });

  it("retour des réglages du téléphone : autorisation accordée, carte fermée et rappels programmés", async () => {
    mock.__state.permission = "denied";
    mock.__state.canAskAgain = false;
    await launch();
    await act(() => actions.requestNotificationPermission());
    await fireEvent.press(screen.getByRole("button", { name: "Ouvrir les réglages" }));
    await emit("background");

    // L'utilisateur autorise DoFirst dans les réglages du téléphone, puis revient
    mock.__state.permission = "granted";
    await emit("active");
    await waitFor(() => expect(screen.queryByTestId("permission-card")).toBeNull());
    await waitFor(() => expect(scheduledFor()).toContain("a"));
  });

  it("retour des réglages sans autorisation : la carte reste, rien n'est programmé", async () => {
    mock.__state.permission = "denied";
    mock.__state.canAskAgain = false;
    await launch();
    await act(() => actions.requestNotificationPermission());
    await emit("background");
    await emit("active");
    await act(async () => {});
    expect(screen.getByTestId("permission-card")).toBeOnTheScreen();
    expect(scheduledFor()).toEqual([]);
  });

  it("une étape avec un jour compte comme un rappel : autorisation demandée (même dans « Si j'ai le temps »)", async () => {
    mock.__state.permission = "undetermined";
    await launch();
    await act(() => router.push("/task?category=NDNI"));
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Ranger la cave");
    await fireEvent.changeText(screen.getByLabelText("Nouvelle étape"), "Trier les cartons");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter une étape" }));
    await fireEvent.press(screen.getByRole("button", { name: "Jour de « Trier les cartons » : Sans jour" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Demain" }));
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Si j'ai le temps »" }));
    await waitFor(() => expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
  });

  it("la tâche est enregistrée même si l'autorisation est refusée", async () => {
    mock.__state.permission = "denied";
    mock.__state.canAskAgain = false;
    await launch();
    // Fiche ouverte depuis la matrice, comme dans l'app
    await act(() => router.push("/task?category=UI"));

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Appeler le client");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Faire »" }));
    expect(state.tasks.map((t) => t.title)).toContain("Appeler le client");
    // Puis la carte vers les réglages, puisque ce rappel n'arrivera pas
    await waitFor(() => expect(screen.getByTestId("permission-card")).toBeOnTheScreen());
  });
});
