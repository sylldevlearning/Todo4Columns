import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import BalanceScreen from "../../app/balance";
import MatrixScreen from "../../app/index";
import {
  addWeeks,
  countCompleted,
  lastSevenDays,
  startOfWeek,
  totalOf,
  weeklyHistory,
} from "../balance";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { TasksProvider } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { Category } from "../types";
import { METRICS } from "../testing/metrics";

// Dates en heure locale : les semaines commencent le lundi à 0 h
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const done = (id: string, category: Category, completedAt: number) =>
  makeTask({ id, category, isDone: true, completedAt });

describe("semaines", () => {
  it("commencent le lundi à 0 h, quel que soit le jour", () => {
    const monday = at(2026, 10, 19, 0);
    expect(startOfWeek(at(2026, 10, 19, 0))).toBe(monday); // lundi 0 h
    expect(startOfWeek(at(2026, 10, 22, 15))).toBe(monday); // jeudi
    expect(startOfWeek(at(2026, 10, 25, 23))).toBe(monday); // dimanche soir
    expect(startOfWeek(at(2026, 10, 26, 0))).toBe(at(2026, 10, 26, 0)); // lundi suivant
  });

  it("passent le changement d'heure sans décalage", () => {
    // Heure d'hiver en Europe le 25 octobre 2026 : la semaine dure 169 h
    const week = startOfWeek(at(2026, 10, 21));
    expect(addWeeks(week, 1)).toBe(at(2026, 10, 26, 0));
    expect(addWeeks(week, -1)).toBe(at(2026, 10, 12, 0));
    expect(new Date(addWeeks(week, -10)).getHours()).toBe(0);
  });
});

describe("calcul de l'équilibre", () => {
  const now = at(2026, 10, 22, 18); // jeudi
  const tasks = [
    done("a", "INU", at(2026, 10, 19, 9)), // cette semaine
    done("b", "INU", at(2026, 10, 21)),
    done("c", "UI", at(2026, 10, 22, 8)),
    done("d", "UDI", at(2026, 10, 18, 23)), // dimanche : semaine précédente
    done("e", "NDNI", at(2026, 10, 14)),
    done("f", "UI", at(2026, 9, 1)), // trop ancienne
    makeTask({ id: "g", category: "INU", isDone: false, completedAt: null }), // pas terminée
    makeTask({ id: "h", category: "INU", isDone: true, completedAt: null }), // date inconnue
    makeTask({ id: "i", category: "INU", isDone: true, completedAt: undefined }), // importée
  ];

  // Journal des fins de tâches correspondant (les tâches sans date de fin n'y sont pas)
  const log = tasks.flatMap((t) =>
    t.isDone && typeof t.completedAt === "number" ? [{ date: t.completedAt, category: t.category }] : []
  );

  it("compte les tâches terminées par quadrant, entre deux dates", () => {
    const week = startOfWeek(now);
    expect(countCompleted(log, week, addWeeks(week, 1))).toEqual({ UI: 1, INU: 2, UDI: 0, NDNI: 0 });
  });

  it("carte « Ta semaine » : les 7 derniers jours glissants", () => {
    // Du jeudi 15 à 18 h au jeudi 22 à 18 h : sans la tâche du 14
    expect(lastSevenDays(log, now)).toEqual({ UI: 1, INU: 2, UDI: 1, NDNI: 0 });
  });

  it("bilan : la semaine en cours puis les 4 précédentes, même vides", () => {
    const history = weeklyHistory(log, now);
    expect(history.map((w) => w.start)).toEqual([
      at(2026, 10, 19, 0),
      at(2026, 10, 12, 0),
      at(2026, 10, 5, 0),
      at(2026, 9, 28, 0),
      at(2026, 9, 21, 0),
    ]);
    expect(history.map((w) => totalOf(w.counts))).toEqual([3, 2, 0, 0, 0]);
    expect(history[1].counts).toEqual({ UI: 0, INU: 0, UDI: 1, NDNI: 1 });
  });

  it("aucune tâche : tout à zéro", () => {
    expect(totalOf(lastSevenDays([], now))).toBe(0);
    expect(weeklyHistory([], now).every((w) => totalOf(w.counts) === 0)).toBe(true);
  });

  it("phrases en français et en anglais", () => {
    expect(fr.balance.anticipated(6, 10)).toBe("6 tâches sur 10 anticipées");
    expect(fr.balance.anticipated(1, 4)).toBe("1 tâche sur 4 anticipée");
    expect(fr.balance.anticipated(0, 3)).toBe("0 tâche sur 3 anticipée");
    expect(en.balance.anticipated(6, 10)).toBe("6 of 10 tasks done ahead of time");
  });
});

describe("carte « Ta semaine » et écran « Bilan »", () => {
  function Layout() {
    return (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Slot />
        </TasksProvider>
      </SafeAreaProvider>
    );
  }
  const launch = async (tasks: ReturnType<typeof makeTask>[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    await renderRouter({ _layout: Layout, index: MatrixScreen, balance: BalanceScreen }, { initialUrl: "/" });
    await act(async () => {});
    await act(async () => {});
  };
  const hour = 60 * 60 * 1000;

  beforeEach(() => AsyncStorage.clear());

  it("moins de 3 tâches terminées : invite à en terminer", async () => {
    await launch([done("a", "INU", Date.now() - hour), done("b", "UI", Date.now() - hour)]);
    expect(screen.getByText("Termine quelques tâches pour voir ton équilibre.")).toBeOnTheScreen();
  });

  it("affiche la part de « Planifier » et ouvre le bilan", async () => {
    await launch([
      done("a", "INU", Date.now() - hour),
      done("b", "INU", Date.now() - 2 * hour),
      done("c", "UI", Date.now() - 3 * hour),
      done("d", "UDI", Date.now() - 30 * 24 * hour), // hors des 7 derniers jours
    ]);
    expect(screen.getByText("2 tâches sur 3 anticipées")).toBeOnTheScreen();
    expect(screen.getByLabelText("En savoir plus : Ton équilibre")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ta semaine. 2 tâches sur 3 anticipées" }));
    expect(await screen.findByRole("header", { name: "Bilan" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Cette semaine" })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Les 4 semaines précédentes" })).toBeOnTheScreen();
    expect(screen.getByText(fr.balance.insight)).toBeOnTheScreen();
    // 4 colonnes, une par semaine précédente
    expect(screen.getAllByLabelText(/^Semaine du /)).toHaveLength(4);
  });
});
