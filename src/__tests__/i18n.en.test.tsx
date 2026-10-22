import { render, screen } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { Platform } from "react-native";
import TaskForm from "../components/TaskForm";
import { CATEGORIES } from "../constants/categories";
import { formatDuration, formatToday } from "../format";
import { language, t } from "../i18n";
import { en } from "../i18n/en";
import { computeSchedule } from "../notifications/schedule";
import { configureNotifications } from "../notifications/setup";
import { DELEGATE_FOLLOW_UP_OPTIONS, DO_NAG_OPTIONS, ReminderOption, reminderLabel } from "../reminders";
import { DEFAULT_SETTINGS } from "../settings";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";

// Téléphone en espagnol : toute langue autre que le français donne l'anglais
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "es", languageTag: "es-ES" }],
}));

const mock = Notifications as unknown as {
  __state: {
    channels: Record<string, { name: string }>;
    categories: Record<string, { buttonTitle: string }[]>;
  };
};

describe("téléphone dans une autre langue que le français", () => {
  it("utilise l'anglais", () => {
    expect(language).toBe("en");
    expect(t).toBe(en);
  });

  it("nomme les quadrants Do / Schedule / Delegate / Someday, sans changer les clés", () => {
    expect(CATEGORIES.map((c) => [c.key, c.name])).toEqual([
      ["UI", "Do"],
      ["INU", "Schedule"],
      ["UDI", "Delegate"],
      ["NDNI", "Someday"],
    ]);
  });

  it("traduit les options de rappel et les durées", () => {
    // Sans l'option « 1 min » réservée au mode développement
    const labels = (options: ReminderOption[]) =>
      options.filter((o) => o.value !== 1).map((o) => o.label);
    expect(labels(DO_NAG_OPTIONS)).toEqual(["30 min", "2 h", "1 day", "Never"]);
    expect(labels(DELEGATE_FOLLOW_UP_OPTIONS)).toEqual(["Tomorrow", "In 3 days", "In 1 week"]);
    expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe("2 d");
    expect(reminderLabel(makeTask({ category: "UI", nagInterval: 120, nagRepeat: true }))).toBe(
      "Reminder 2 h · repeated"
    );
  });

  it("formate les dates en anglais", () => {
    expect(formatToday(new Date(2026, 9, 22))).toBe("Thursday, October 22");
  });

  it("traduit le texte des notifications", () => {
    const now = new Date(2026, 9, 22, 10).getTime();
    const bodies = (task: Partial<Task>) =>
      computeSchedule(makeTask({ updatedAt: now, ...task }), DEFAULT_SETTINGS, now).map(
        (n) => n.content.body
      );

    expect(bodies({ category: "UI", nagInterval: 30, nagRepeat: true })).toEqual([
      "Still not done? Reminder 1/3",
      "Still not done? Reminder 2/3",
      "Still not done? Reminder 3/3",
    ]);
    expect(bodies({ category: "UDI", nagInterval: 60, delegatedTo: "Sam" })).toEqual([
      "Any news from Sam?",
    ]);
    expect(
      bodies({ category: "INU", dueAt: now + 3 * 3600 * 1000, reminderOffset: 60 }).at(-1)
    ).toBe("Due date reached. Move it to Do?");
    expect(bodies({ category: "INU", timerEnd: now + 60000 })).toEqual(["Timer finished"]);
  });

  it("traduit le canal Android et les boutons d'action des notifications", async () => {
    Platform.OS = "android";
    await configureNotifications();
    expect(mock.__state.channels.reminders.name).toBe("Reminders");
    expect(mock.__state.categories["task-reminder"].map((a) => a.buttonTitle)).toEqual([
      "Done",
      "Snooze 1 h",
      "Open",
    ]);
  });

  it("affiche la fiche de création en anglais", async () => {
    await render(
      <TaskForm settings={DEFAULT_SETTINGS} initialCategory="UDI" onSubmit={() => {}} />
    );
    for (const text of ["New task", "Is it urgent?", "Is it important?", "→ Delegate", "Add to Delegate"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByPlaceholderText("Person's name")).toBeTruthy();
  });
});
