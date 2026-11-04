import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import TaskAlerts from "../components/TaskAlerts";
import TaskChips from "../components/TaskChips";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { formatDuration } from "../format";
import { isPastDue, isWaiting, nextFollowUp } from "../notifications/status";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { makeTask } from "../testing/makeTask";

const MIN = 60 * 1000;
const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime();
const NOW = at(10);
const NO_QUIET: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00" };

describe("formatDuration", () => {
  it("formate minutes, heures et jours", () => {
    expect(formatDuration(45 * MIN)).toBe("45 min");
    expect(formatDuration(80 * MIN)).toBe("1 h 20");
    expect(formatDuration(180 * MIN)).toBe("3 h");
    expect(formatDuration(2 * 24 * 60 * MIN)).toBe("2 j");
    expect(formatDuration(79.2 * MIN, "up")).toBe("1 h 20");
  });
});

describe("états d'une tâche", () => {
  const doIt = makeTask({ category: "UI", updatedAt: at(7), nagInterval: 120 });

  it("Faire est en attente au-delà de son délai, sauf si elle est reportée", () => {
    expect(isWaiting(doIt, at(8, 59))).toBe(false);
    expect(isWaiting(doIt, NOW)).toBe(true);
    expect(isWaiting({ ...doIt, snoozedUntil: at(11) }, NOW)).toBe(false);
    expect(isWaiting({ ...doIt, isDone: true }, NOW)).toBe(false);
    expect(isWaiting({ ...doIt, nagInterval: null }, NOW)).toBe(false);
  });

  it("Planifier à échéance passée", () => {
    const plan = makeTask({ category: "INU", dueAt: at(9) });
    expect(isPastDue(plan, NOW)).toBe(true);
    expect(isPastDue({ ...plan, dueAt: at(11) }, NOW)).toBe(false);
  });

  it("donne la prochaine relance", () => {
    const next = nextFollowUp({ ...doIt, updatedAt: at(9), nagRepeat: true }, NO_QUIET, NOW);
    expect(next).toMatchObject({ date: at(11), nagIndex: 1, nagTotal: 3 });
  });
});

describe("puces", () => {
  const ui = CATEGORY_BY_KEY.UI;

  it("Faire : « Relance dans 1 h 20 » et « Relance 2/3 »", async () => {
    // Relance 1 à 9 h 40 (passée), relance 2 à 11 h 20
    const task = makeTask({ category: "UI", updatedAt: at(8), nagInterval: 100, nagRepeat: true });
    await render(<TaskChips task={task} category={ui} settings={NO_QUIET} now={NOW} />);

    expect(screen.getByText("Relance dans 1 h 20")).toBeOnTheScreen();
    expect(screen.getByText("Relance 2/3")).toBeOnTheScreen();
  });

  it("Faire en attente : « En attente depuis 3 h »", async () => {
    const task = makeTask({ category: "UI", updatedAt: at(7), nagInterval: 120 });
    await render(<TaskChips task={task} category={ui} settings={NO_QUIET} now={NOW} />);
    expect(screen.getByText("En attente depuis 3 h")).toBeOnTheScreen();
  });

  it("Planifier : échéance au format « Ven. 24 oct. · 09:00 »", async () => {
    const task = makeTask({ category: "INU", dueAt: at(9, 0, 23), reminderOffset: 60 });
    await render(
      <TaskChips task={task} category={CATEGORY_BY_KEY.INU} settings={NO_QUIET} now={NOW} />
    );
    expect(screen.getByText("Ven. 23 oct. · 09:00")).toBeOnTheScreen();
    expect(screen.getByText("1 h avant")).toBeOnTheScreen();
  });
});

describe("boutons d'une tâche à décider", () => {
  const handlers = () => ({ onSnooze: jest.fn(), onMove: jest.fn(), onMoveToDo: jest.fn() });

  it("Faire en attente : « Reporter 1 h » et « Déplacer… »", async () => {
    const h = handlers();
    const task = makeTask({ id: "a", category: "UI", updatedAt: at(7), nagInterval: 120 });
    await render(<TaskAlerts task={task} now={NOW} {...h} />);

    await fireEvent.press(screen.getByRole("button", { name: "Reporter 1 h" }));
    await fireEvent.press(screen.getByRole("button", { name: "Déplacer…" }));
    expect(h.onSnooze).toHaveBeenCalledWith("a");
    expect(h.onMove).toHaveBeenCalledWith("a");
  });

  it("Planifier à échéance passée : « Passer en Faire »", async () => {
    const h = handlers();
    const task = makeTask({ id: "b", category: "INU", dueAt: at(9) });
    await render(<TaskAlerts task={task} now={NOW} {...h} />);

    await fireEvent.press(screen.getByRole("button", { name: "Passer en Faire" }));
    expect(h.onMoveToDo).toHaveBeenCalledWith("b");
  });

  it("rien à afficher pour une tâche à jour", async () => {
    const task = makeTask({ category: "UI", updatedAt: at(9, 30), nagInterval: 120 });
    await render(<TaskAlerts task={task} now={NOW} {...handlers()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
