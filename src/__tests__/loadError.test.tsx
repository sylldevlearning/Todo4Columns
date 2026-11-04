import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoadErrorGate from "../components/LoadErrorGate";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { TasksProvider } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";

const getItem = AsyncStorage.getItem as jest.Mock;
const original = getItem.getMockImplementation()!;
let failing = true;

beforeEach(async () => {
  await AsyncStorage.clear();
  failing = true;
  // Lecture des tâches impossible tant que failing est vrai
  getItem.mockImplementation((key: string) =>
    key === STORAGE_KEY && failing ? Promise.reject(new Error("disque illisible")) : original(key)
  );
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // Déjà un jest.fn dans le mock d'AsyncStorage : on remet son implémentation
  getItem.mockImplementation(original);
});

describe("lecture des tâches impossible", () => {
  it("message clair à la place des écrans, saisie bloquée, rien n'est écrasé ; « Réessayer » relit", async () => {
    const saved = serializeTasks([makeTask({ id: "a", title: "Tâche enregistrée" })]);
    await AsyncStorage.setItem(STORAGE_KEY, saved);

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <LoadErrorGate>
            <Text>Écrans de l'app</Text>
          </LoadErrorGate>
        </TasksProvider>
      </SafeAreaProvider>
    );

    expect(await screen.findByRole("header", { name: "Impossible de lire tes tâches" })).toBeOnTheScreen();
    expect(screen.getByText(/Tes tâches n'ont pas été modifiées/)).toBeOnTheScreen();
    // Les écrans (et donc la saisie) ne sont pas affichés
    expect(screen.queryByText("Écrans de l'app")).toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 500)));
    expect(await original(STORAGE_KEY)).toBe(saved);

    failing = false;
    await fireEvent.press(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Écrans de l'app")).toBeOnTheScreen();
    expect(screen.queryByText("Impossible de lire tes tâches")).toBeNull();
  });
});
