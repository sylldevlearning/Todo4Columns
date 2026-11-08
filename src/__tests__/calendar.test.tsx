import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CalendarScreen from "../../app/calendar";
import {
  addMonths,
  BLOCK_MINUTES,
  calendarEntries,
  CalendarEntry,
  daySummary,
  dayTimeline,
  monthGrid,
  weekStartFor,
} from "../calendar";
import { addDays, dayKey } from "../dates";
import { serializeTasks } from "../migrations";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TasksProvider } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m, d, h, min).getTime();

describe("grille du mois", () => {
  it("semaine commençant le lundi ou le dimanche selon la langue", () => {
    expect(weekStartFor("fr")).toBe(1);
    expect(weekStartFor("de")).toBe(1);
    expect(weekStartFor("zh-Hans")).toBe(1);
    expect(weekStartFor("en")).toBe(0);
    expect(weekStartFor("pt-BR")).toBe(0);
    expect(weekStartFor("ja")).toBe(0);
  });

  it("6 semaines de 7 jours, jours voisins compris", () => {
    // Novembre 2026 : le 1er est un dimanche
    const monday = monthGrid({ year: 2026, month: 10 }, 1);
    expect(monday).toHaveLength(42);
    expect(monday[0]).toBe("2026-10-26"); // lundi
    expect(monday[6]).toBe("2026-11-01");
    expect(monday[41]).toBe("2026-12-06");
    const sunday = monthGrid({ year: 2026, month: 10 }, 0);
    expect(sunday[0]).toBe("2026-11-01");
    // Février 2027 : 28 jours
    expect(monthGrid({ year: 2027, month: 1 }, 1)).toContain("2027-02-28");
  });

  it("mois suivant et précédent, changement d'année", () => {
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("contenu des jours", () => {
  it("échéances, étapes prévues, tâches faites grisées, archivées exclues", () => {
    const tasks = [
      makeTask({ id: "due", title: "Rapport", category: "INU", dueAt: at(2026, 10, 10, 14, 30) }),
      makeTask({ id: "done", title: "Faite", category: "UI", dueAt: at(2026, 10, 10, 8), isDone: true }),
      makeTask({ id: "archived", title: "Archivée", category: "NDNI", dueAt: at(2026, 10, 10), archivedAt: 1 }),
      makeTask({
        id: "steps",
        title: "Déménagement",
        category: "INU",
        steps: [
          { id: "s1", title: "Cartons", done: false, doneAt: null, day: "2026-11-10", time: null },
          { id: "s2", title: "Camion", done: true, doneAt: 1, day: "2026-11-12", time: "10:00" },
          { id: "s3", title: "Sans jour", done: false, doneAt: null, day: null, time: null },
        ],
      }),
    ];
    const byDay = calendarEntries(tasks, "2026-11-01", "2026-11-30");
    const tenth = byDay.get("2026-11-10")!;
    expect(tenth.map((e) => [e.taskId, e.kind, e.time, e.done])).toEqual([
      ["done", "due", "08:00", true],
      ["due", "due", "14:30", false],
      ["steps", "step", null, false], // sans heure : en dernier
    ]);
    expect(tenth[2].stepTitle).toBe("Cartons");
    expect(byDay.get("2026-11-12")![0]).toMatchObject({ kind: "step", stepTitle: "Camion", done: true });
    expect([...byDay.values()].flat().some((e) => e.taskId === "archived")).toBe(false);
    // Hors de la plage : rien
    expect(calendarEntries(tasks, "2026-12-01", "2026-12-31").size).toBe(0);
  });

  it("tâche récurrente : occurrence réelle, puis occurrences futures calculées « prévues »", () => {
    // Chaque lundi et jeudi à 9 h, prochaine occurrence réelle le jeudi 5 novembre
    const weekly = makeTask({
      id: "w",
      title: "Sport",
      category: "INU",
      dueAt: at(2026, 10, 5),
      recurrence: { freq: "weekly", days: [1, 4] },
    });
    const byDay = calendarEntries([weekly], "2026-11-01", "2026-11-30");
    const days = [...byDay.entries()].map(([day, list]) => [day, list[0].kind]).sort();
    expect(days).toEqual([
      ["2026-11-05", "due"],
      ["2026-11-09", "planned"],
      ["2026-11-12", "planned"],
      ["2026-11-16", "planned"],
      ["2026-11-19", "planned"],
      ["2026-11-23", "planned"],
      ["2026-11-26", "planned"],
      ["2026-11-30", "planned"],
    ]);
    expect(byDay.get("2026-11-09")![0]).toMatchObject({ time: "09:00", done: false });
    // Pas d'occurrence avant l'échéance réelle
    expect(byDay.has("2026-11-02")).toBe(false);
  });

  it("mois plus tard : occurrences calculées sans parcourir les mois d'avant ; tâche faite non projetée", () => {
    const daily = makeTask({ id: "d", title: "Médicament", category: "UI", dueAt: at(2026, 0, 1, 8), recurrence: { freq: "daily" } });
    const march = calendarEntries([daily], "2027-03-01", "2027-03-31");
    expect(march.size).toBe(31);
    expect(march.get("2027-03-15")![0]).toMatchObject({ kind: "planned", time: "08:00" });

    const monthly = makeTask({ id: "m", title: "Loyer", category: "INU", dueAt: at(2026, 10, 30), recurrence: { freq: "monthly" } });
    const winter = calendarEntries([monthly], "2026-11-01", "2027-02-28");
    // Le 30 de chaque mois, ramené au 28 en février
    expect([...winter.keys()].sort()).toEqual(["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"]);

    const done = { ...daily, isDone: true };
    expect(calendarEntries([done], "2027-03-01", "2027-03-31").size).toBe(0);
  });

  it("beaucoup de tâches : un mois se calcule vite", () => {
    const many = Array.from({ length: 3000 }, (_, i) =>
      makeTask({
        id: `t${i}`,
        title: `Tâche ${i}`,
        category: (["UI", "INU", "UDI", "NDNI"] as const)[i % 4],
        dueAt: at(2026, 10, 1 + (i % 30), 8 + (i % 10)),
        recurrence: i % 50 === 0 ? { freq: "daily" } : null,
      })
    );
    const start = Date.now();
    const byDay = calendarEntries(many, "2026-10-26", "2026-12-06");
    expect(Date.now() - start).toBeLessThan(1000);
    const summary = daySummary(byDay.get("2026-11-15"));
    // 100 échéances ce jour-là + 40 tâches quotidiennes commencées avant (celles du 21 pas encore)
    expect(summary.count).toBe(140);
    expect(summary.categories).toEqual(["UI", "UDI"]);
  });

  it("résumé : nombre et quadrants dans l'ordre de la matrice", () => {
    expect(daySummary(undefined)).toEqual({ count: 0, categories: [] });
    const entries = [{ category: "NDNI" }, { category: "UI" }, { category: "UI" }] as CalendarEntry[];
    expect(daySummary(entries)).toEqual({ count: 3, categories: ["UI", "NDNI"] });
  });
});

describe("frise horaire", () => {
  const entry = (key: string, time: string | null): CalendarEntry => ({
    key,
    taskId: key,
    title: key,
    stepTitle: null,
    category: "INU",
    time,
    kind: "due",
    done: false,
  });

  it("journée 8 h – 20 h, élargie ; blocs qui se chevauchent en colonnes ; sans heure à part", () => {
    const timeline = dayTimeline([
      entry("a", "07:00"),
      entry("b", "10:00"),
      entry("c", "10:15"),
      entry("d", "10:30"),
      entry("e", "15:00"),
      entry("f", "22:30"),
      entry("g", null),
    ]);
    expect(timeline.startHour).toBe(7);
    expect(timeline.endHour).toBe(24);
    const byKey = Object.fromEntries(timeline.blocks.map((b) => [b.entry.key, b]));
    expect(byKey.a).toMatchObject({ minutes: 420, column: 0, columns: 1 });
    // 10:00, 10:15, 10:30 se chevauchent (blocs de 45 min)
    expect([byKey.b.column, byKey.c.column, byKey.d.column]).toEqual([0, 1, 2]);
    expect(byKey.b.columns).toBe(3);
    expect(byKey.e).toMatchObject({ column: 0, columns: 1 });
    expect(timeline.untimed.map((e) => e.key)).toEqual(["g"]);
    expect(BLOCK_MINUTES).toBe(45);
  });

  it("sans tâche à heure fixe : journée type", () => {
    expect(dayTimeline([entry("x", null)])).toMatchObject({ startHour: 8, endHour: 20, blocks: [] });
  });
});

describe("écran Calendrier", () => {
  const today = dayKey(Date.now());
  const tomorrow = addDays(today, 1);
  const todayAt = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.getTime();
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockPush.mockClear();
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({ id: "a", title: "Dentiste", category: "INU", dueAt: todayAt(15) }),
        makeTask({ id: "b", title: "Courses", category: "UI", dueAt: todayAt(9), isDone: true }),
        makeTask({
          id: "c",
          title: "Projet",
          category: "UDI",
          steps: [{ id: "s", title: "Brouillon", done: false, doneAt: null, day: today, time: null }],
        }),
        makeTask({ id: "r", title: "Sport", category: "INU", dueAt: todayAt(18), recurrence: { freq: "daily" } }),
      ])
    );
  });

  const renderScreen = async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <CalendarScreen />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await act(async () => {});
    await waitFor(() => expect(screen.getByLabelText(new RegExp(`4 tâches`))).toBeOnTheScreen());
  };

  it("jour du jour : nombre, répartition, frise, « Sans heure », tâche faite grisée", async () => {
    await renderScreen();
    const panel = screen.getByTestId("calendar-day-panel");
    expect(within(panel).getByText("4 tâches")).toBeOnTheScreen();
    expect(within(panel).getByText("Planifier · 2")).toBeOnTheScreen();
    expect(within(panel).getByText("Faire · 1")).toBeOnTheScreen();
    expect(within(panel).getByText("Déléguer · 1")).toBeOnTheScreen();
    const timeline = within(panel).getByTestId("calendar-timeline");
    expect(within(timeline).getByText("Dentiste")).toBeOnTheScreen();
    expect(within(timeline).getByText("Courses")).toBeOnTheScreen();
    expect(within(panel).getByText("Sans heure")).toBeOnTheScreen();
    expect(within(panel).getByText("Étape : Brouillon")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /^Courses/ }).props.accessibilityState).toMatchObject({ checked: true });
  });

  it("appui sur une tâche : sa fiche ; occurrence prévue : rien", async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: /^Dentiste/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/task", params: { id: "a" } });

    // Demain : l'occurrence de « Sport » est seulement prévue
    await fireEvent.press(screen.getByTestId(`day-${tomorrow}`));
    const planned = screen.getByLabelText(/^Sport, 18:00 · Prévue/);
    expect(planned).toHaveProp("accessibilityHint", "Occurrence prévue d'une tâche récurrente, non modifiable");
    expect(screen.queryByRole("button", { name: /^Sport/ })).toBeNull();
  });

  it("mois suivant, précédent et « Aujourd'hui »", async () => {
    await renderScreen();
    const title = (d: Date) => {
      const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const now = new Date();
    await fireEvent.press(screen.getByRole("button", { name: "Mois suivant" }));
    expect(screen.getByText(title(new Date(now.getFullYear(), now.getMonth() + 1, 1)))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Mois précédent" }));
    await fireEvent.press(screen.getByRole("button", { name: "Mois précédent" }));
    expect(screen.getByText(title(new Date(now.getFullYear(), now.getMonth() - 1, 1)))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Aujourd'hui" }));
    expect(screen.getByText(title(now))).toBeOnTheScreen();
    expect(screen.getByTestId(`day-${today}`)).toBeSelected();
  });

  it("« i » du calendrier ; semaine du lundi en français", async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText("En savoir plus : Calendrier"));
    expect(screen.getByText(/Touche un jour pour voir sa frise horaire/)).toBeOnTheScreen();
    // Première colonne : un lundi
    const firstCell = screen.getAllByTestId(/^day-/)[0];
    const firstDay = firstCell.props.testID.slice(4);
    expect(new Date(`${firstDay}T12:00:00`).getDay()).toBe(1);
  });
});
