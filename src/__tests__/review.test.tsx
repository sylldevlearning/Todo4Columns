import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, renderHook, waitFor } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import MatrixScreen from "../../app/index";
import ReviewScreen from "../../app/review";
import SettingsScreen from "../../app/settings";
import { addWeeks, startOfWeek } from "../balance";
import MatrixGrid from "../components/MatrixGrid";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import {
  isPriority,
  loadReviewWeeks,
  priorityTargetWeek,
  recordReview,
  REVIEW_LOG_KEY,
  reviewStreak,
} from "../review";
import { STORAGE_KEY } from "../storage";
import { TasksProvider, TasksState, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";

const mockCelebrate = jest.fn(() => 1);
jest.mock("../celebration/CelebrationProvider", () => ({
  useCelebration: () => ({ celebrate: mockCelebrate, dismiss: jest.fn() }),
}));

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe("priorités de la semaine", () => {
  it("du lundi au jeudi, pour la semaine en cours ; à partir du vendredi, pour la suivante", () => {
    const week = at(2026, 10, 19, 0);
    expect(priorityTargetWeek(at(2026, 10, 19, 9))).toBe(week); // lundi
    expect(priorityTargetWeek(at(2026, 10, 22, 20))).toBe(week); // jeudi
    expect(priorityTargetWeek(at(2026, 10, 23))).toBe(at(2026, 10, 26, 0)); // vendredi
    expect(priorityTargetWeek(at(2026, 10, 25, 18))).toBe(at(2026, 10, 26, 0)); // dimanche 18 h
  });

  it("l'étoile s'affiche jusqu'à la fin de la semaine visée, puis expire d'elle-même", () => {
    // Choisie le dimanche 25 à 18 h pour la semaine du lundi 26
    const task = makeTask({ category: "INU", priorityWeek: at(2026, 10, 26, 0) });
    expect(isPriority(task, at(2026, 10, 25, 18))).toBe(true); // dès le choix
    expect(isPriority(task, at(2026, 10, 28))).toBe(true); // pendant la semaine
    expect(isPriority(task, at(2026, 11, 1, 23))).toBe(true); // dimanche soir
    expect(isPriority(task, at(2026, 11, 2, 0))).toBe(false); // lundi suivant : retirée
  });

  it("pas d'étoile sur une tâche terminée, archivée ou sans priorité", () => {
    const now = at(2026, 10, 21);
    const week = startOfWeek(now);
    expect(isPriority(makeTask({ priorityWeek: week, isDone: true }), now)).toBe(false);
    expect(isPriority(makeTask({ priorityWeek: week, archivedAt: 1 }), now)).toBe(false);
    expect(isPriority(makeTask({ priorityWeek: null }), now)).toBe(false);
    expect(isPriority(makeTask({ priorityWeek: undefined }), now)).toBe(false);
  });

  it("l'étoile apparaît dans la grille, pas celle d'une semaine passée", async () => {
    const week = startOfWeek(Date.now());
    await render(
      <MatrixGrid
        tasks={[
          makeTask({ id: "a", title: "Préparer le budget", category: "INU", priorityWeek: week }),
          makeTask({ id: "b", title: "Ancienne priorité", category: "INU", priorityWeek: addWeeks(week, -1) }),
        ]}
        onOpenQuadrant={() => {}}
      />
    );
    expect(screen.getAllByLabelText("priorité de la semaine")).toHaveLength(1);
  });

  it("le choix remplace les priorités en cours, sans toucher au départ des relances", async () => {
    const week = startOfWeek(Date.now());
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "a", category: "INU", updatedAt: 5 }),
        makeTask({ id: "b", category: "INU", updatedAt: 6, priorityWeek: week }),
        makeTask({ id: "c", category: "INU", updatedAt: 7, priorityWeek: addWeeks(week, -2) }),
      ])
    );
    const { result } = await renderHook(() => useTasks());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    await act(() => result.current.setWeekPriorities(["a"], week));
    const byId = Object.fromEntries(result.current.tasks.map((t) => [t.id, t]));
    expect(byId.a).toMatchObject({ priorityWeek: week, updatedAt: 5 });
    expect(byId.b).toMatchObject({ priorityWeek: null, updatedAt: 6 });
    // Une priorité déjà expirée reste telle quelle (elle ne s'affiche plus)
    expect(byId.c.priorityWeek).toBe(addWeeks(week, -2));
  });
});

describe("série de revues", () => {
  beforeEach(() => AsyncStorage.clear());

  it("compte les semaines d'affilée, depuis cette semaine ou la précédente", () => {
    const now = at(2026, 10, 22);
    const w = (n: number) => addWeeks(startOfWeek(now), n);
    expect(reviewStreak([], now)).toBe(0);
    expect(reviewStreak([w(0)], now)).toBe(1);
    expect(reviewStreak([w(0), w(-1), w(-2), w(-4)], now)).toBe(3);
    // Revue de cette semaine pas encore faite : la série en cours n'est pas perdue
    expect(reviewStreak([w(-1), w(-2)], now)).toBe(2);
    expect(reviewStreak([w(-2)], now)).toBe(0);
  });

  it("enregistre une semaine une seule fois", async () => {
    const now = at(2026, 10, 25, 18);
    expect(await recordReview(now)).toBe(1);
    expect(await recordReview(now + 60_000)).toBe(1);
    expect(await recordReview(addWeeks(now, 1))).toBe(2);
    expect(await loadReviewWeeks()).toHaveLength(2);
  });

  it("un historique illisible repart de zéro", async () => {
    await AsyncStorage.setItem(REVIEW_LOG_KEY, "{abîmé");
    expect(await loadReviewWeeks()).toEqual([]);
  });
});

describe("parcours de la revue", () => {
  const METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 40, left: 0, right: 0, bottom: 20 },
  };
  let state: TasksState;
  function Grab() {
    state = useTasksSelector((s) => s);
    return null;
  }
  function Layout() {
    return (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Slot />
          <Grab />
        </TasksProvider>
      </SafeAreaProvider>
    );
  }
  const task = (id: string) => state.tasks.find((t) => t.id === id)!;

  const launch = async (tasks: Task[], initialUrl = "/") => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    await renderRouter(
      { _layout: Layout, index: MatrixScreen, review: ReviewScreen, settings: SettingsScreen },
      { initialUrl }
    );
    await act(async () => {});
    await act(async () => {});
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockCelebrate.mockClear();
  });

  it("trie « Si j'ai le temps », choisit 3 priorités, suit les tâches confiées, puis célèbre", async () => {
    await launch([
      makeTask({ id: "n1", title: "Apprendre la guitare", category: "NDNI" }),
      makeTask({ id: "n2", title: "Trier les photos", category: "NDNI" }),
      makeTask({ id: "n3", title: "Ranger le garage", category: "NDNI" }),
      makeTask({ id: "p1", title: "Préparer le budget", category: "INU" }),
      makeTask({ id: "p2", title: "Réviser l'examen", category: "INU" }),
      makeTask({ id: "p3", title: "Faire du sport", category: "INU" }),
      makeTask({ id: "d1", title: "Compte rendu", category: "UDI", delegatedTo: "Marie", updatedAt: 5 }),
      makeTask({ id: "d2", title: "Devis du garage", category: "UDI", updatedAt: 5 }),
    ]);

    // Depuis la matrice
    await fireEvent.press(screen.getByRole("button", { name: "Faire la revue de la semaine" }));
    expect(await screen.findByText("Étape 1 sur 3")).toBeOnTheScreen();
    expect(screen.getByLabelText("En savoir plus : Revue de la semaine")).toBeOnTheScreen();

    // 1. Si j'ai le temps : Garder (par défaut) / Planifier / Archiver
    expect(screen.getAllByRole("radio", { name: "Garder" })[0]).toBeSelected();
    await fireEvent.press(screen.getAllByRole("radio", { name: "Planifier" })[0]); // n1
    await fireEvent.press(screen.getAllByRole("radio", { name: "Archiver" })[1]); // n2
    await fireEvent.press(screen.getByRole("button", { name: "Suivant" }));
    expect(task("n1").category).toBe("INU");
    expect(task("n2").archivedAt).not.toBeNull();
    expect(task("n3")).toMatchObject({ category: "NDNI", archivedAt: null });

    // 2. Priorités : 3 au maximum, la tâche tout juste planifiée est proposée
    expect(screen.getByText("Étape 2 sur 3")).toBeOnTheScreen();
    expect(screen.getByText("0 sur 3 choisie")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Préparer le budget" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Apprendre la guitare" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Réviser l'examen" }));
    expect(screen.getByText("3 sur 3 choisies")).toBeOnTheScreen();
    expect(screen.getByRole("checkbox", { name: "Faire du sport" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Suivant" }));
    const week = priorityTargetWeek(Date.now());
    for (const id of ["p1", "n1", "p2"]) expect(task(id).priorityWeek).toBe(week);
    expect(task("p3").priorityWeek).toBeNull();

    // 3. Tâches confiées : Fait / Toujours en attente
    expect(screen.getByText("Étape 3 sur 3")).toBeOnTheScreen();
    expect(screen.getByText("Confiée à Marie")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole("radio", { name: "Fait" })[0]); // d1
    await fireEvent.press(screen.getAllByRole("radio", { name: "Toujours en attente" })[1]); // d2
    await fireEvent.press(screen.getByRole("button", { name: "Terminer la revue" }));
    expect(task("d1")).toMatchObject({ isDone: true, completedAt: expect.any(Number) });
    // La relance de la personne repart de zéro
    expect(task("d2").isDone).toBe(false);
    expect(task("d2").updatedAt).toBeGreaterThan(5);

    // Fin : équilibre, célébration « Planifier » et série
    expect(screen.getByRole("header", { name: "Revue terminée !" })).toBeOnTheScreen();
    expect(screen.getByText("Ton équilibre cette semaine")).toBeOnTheScreen();
    expect(mockCelebrate).toHaveBeenCalledWith("INU");
    expect(await screen.findByText("1 semaine de revue d'affilée")).toBeOnTheScreen();
    expect(await loadReviewWeeks()).toEqual([startOfWeek(Date.now())]);

    await fireEvent.press(screen.getByRole("button", { name: "Terminer" }));
    expect(screen.getByRole("header", { name: "Ma matrice" })).toBeOnTheScreen();
  });

  it("« Passer » sur chaque étape ne change rien, et la revue compte quand même", async () => {
    const before = [
      makeTask({ id: "n1", title: "Apprendre la guitare", category: "NDNI" }),
      makeTask({ id: "p1", title: "Préparer le budget", category: "INU" }),
      makeTask({ id: "d1", title: "Compte rendu", category: "UDI" }),
    ];
    await launch(before, "/review");

    await fireEvent.press(screen.getAllByRole("radio", { name: "Archiver" })[0]);
    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Préparer le budget" }));
    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    await fireEvent.press(screen.getAllByRole("radio", { name: "Fait" })[0]);
    await fireEvent.press(screen.getByRole("button", { name: "Passer" }));

    expect(screen.getByRole("header", { name: "Revue terminée !" })).toBeOnTheScreen();
    expect(state.tasks).toEqual(before);
    expect(await screen.findByText("1 semaine de revue d'affilée")).toBeOnTheScreen();
  });

  it("étapes vides : un message, et les priorités en cours sont présélectionnées", async () => {
    await launch(
      [makeTask({ id: "p1", title: "Préparer le budget", category: "INU", priorityWeek: startOfWeek(Date.now()) })],
      "/review"
    );
    expect(screen.getByText("Rien dans « Si j'ai le temps ». Passe à la suite.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByRole("checkbox", { name: "Préparer le budget" })).toBeChecked();
    await fireEvent.press(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText("Aucune tâche confiée en attente.")).toBeOnTheScreen();
  });

  it("s'ouvre aussi depuis les Réglages", async () => {
    await launch([], "/settings");
    expect(screen.getByLabelText("En savoir plus : Revue de la semaine")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Faire la revue maintenant" }));
    expect(await screen.findByText("Étape 1 sur 3")).toBeOnTheScreen();
  });
});
