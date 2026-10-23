import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import SettingsForm from "../components/SettingsForm";
import { weeklyReviewTrigger } from "../notifications/schedule";
import {
  MAX_SCHEDULED,
  reconcileNotifications,
  syncTaskNotifications,
} from "../notifications/service";
import { handleNotificationResponse } from "../notifications/setup";
import { DEFAULT_SETTINGS, notificationSettingsKey, parseSettings, Settings } from "../settings";
import { makeTask } from "../testing/makeTask";

const mock = Notifications as unknown as {
  __state: {
    scheduled: { identifier: string; content: any; trigger: any }[];
    permission: string;
  };
};
const scheduled = () => mock.__state.scheduled;
const reviews = () => scheduled().filter((n) => n.content.data?.type === "review");

const NOW = new Date(2026, 9, 22, 10).getTime(); // jeudi
const NO_QUIET: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00" };

describe("jour et heure de la notification de revue", () => {
  it("par défaut, le dimanche à 18 h (hors plage silencieuse 22 h - 8 h)", () => {
    expect(weeklyReviewTrigger(DEFAULT_SETTINGS, NOW)).toEqual({ weekday: 1, hour: 18, minute: 0 });
  });

  it("désactivée : rien à programmer", () => {
    expect(weeklyReviewTrigger({ ...DEFAULT_SETTINGS, weeklyReview: false }, NOW)).toBeNull();
  });

  it("dans la plage silencieuse : décalée à sa fin, le lendemain si besoin", () => {
    // Samedi 23 h → dimanche 8 h
    expect(
      weeklyReviewTrigger({ ...DEFAULT_SETTINGS, weeklyReviewDay: 6, weeklyReviewTime: "23:00" }, NOW)
    ).toEqual({ weekday: 1, hour: 8, minute: 0 });
    // Lundi 6 h 30 → lundi 8 h
    expect(
      weeklyReviewTrigger({ ...DEFAULT_SETTINGS, weeklyReviewDay: 1, weeklyReviewTime: "06:30" }, NOW)
    ).toEqual({ weekday: 2, hour: 8, minute: 0 });
    // Sans plage silencieuse : l'heure choisie
    expect(
      weeklyReviewTrigger({ ...NO_QUIET, weeklyReviewDay: 6, weeklyReviewTime: "23:00" }, NOW)
    ).toEqual({ weekday: 7, hour: 23, minute: 0 });
  });

  it("ne dépend pas du jour où l'app est ouverte", () => {
    for (let day = 0; day < 7; day++) {
      const reference = new Date(2026, 9, 18 + day, 21).getTime();
      expect(weeklyReviewTrigger(DEFAULT_SETTINGS, reference)).toEqual({ weekday: 1, hour: 18, minute: 0 });
    }
  });
});

describe("programmation de la notification de revue", () => {
  it("une notification hebdomadaire, gardée telle quelle d'une réconciliation à l'autre", async () => {
    await reconcileNotifications([], DEFAULT_SETTINGS, NOW);
    expect(reviews()).toHaveLength(1);
    expect(reviews()[0]).toMatchObject({
      content: {
        title: "Revue de la semaine",
        body: "5 minutes pour faire le point et choisir tes priorités.",
        data: { type: "review", weekday: 1, hour: 18, minute: 0 },
      },
      trigger: { type: "weekly", weekday: 1, hour: 18, minute: 0, channelId: "reminders" },
    });
    // Pas de boutons Fait / Reporter : elle ne concerne aucune tâche
    expect(reviews()[0].content.categoryIdentifier).toBeUndefined();

    const id = reviews()[0].identifier;
    await reconcileNotifications([], DEFAULT_SETTINGS, NOW);
    expect(reviews().map((n) => n.identifier)).toEqual([id]);
  });

  it("remplacée quand le jour ou l'heure change, annulée quand la revue est désactivée", async () => {
    await reconcileNotifications([], DEFAULT_SETTINGS, NOW);
    await reconcileNotifications([], { ...DEFAULT_SETTINGS, weeklyReviewDay: 5, weeklyReviewTime: "17:30" }, NOW);
    expect(reviews()).toHaveLength(1);
    expect(reviews()[0].trigger).toMatchObject({ weekday: 6, hour: 17, minute: 30 });

    await reconcileNotifications([], { ...DEFAULT_SETTINGS, weeklyReview: false }, NOW);
    expect(reviews()).toHaveLength(0);
  });

  it("sans autorisation, rien n'est programmé", async () => {
    mock.__state.permission = "denied";
    await reconcileNotifications([], DEFAULT_SETTINGS, NOW);
    expect(scheduled()).toHaveLength(0);
  });

  it("réserve sa place dans la limite iOS de 64", async () => {
    const tasks = Array.from({ length: 70 }, (_, i) =>
      makeTask({ id: `t${i}`, category: "UI", updatedAt: NOW, nagInterval: i + 1 })
    );
    const result = await reconcileNotifications(tasks, NO_QUIET, NOW);

    expect(scheduled()).toHaveLength(MAX_SCHEDULED);
    expect(reviews()).toHaveLength(1);
    expect(result.t62).toHaveLength(1);
    expect(result.t63).toEqual([]); // la 64e place revient à la revue
  });

  it("une tâche ajoutée ne prend pas la place réservée à la revue", async () => {
    for (let i = 0; i < MAX_SCHEDULED - 1; i++) {
      await Notifications.scheduleNotificationAsync({
        content: { title: "autre" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: NOW + 60_000 },
      });
    }
    const task = makeTask({ id: "a", category: "UI", updatedAt: NOW, nagInterval: 30 });
    expect(await syncTaskNotifications(task, NO_QUIET, NOW)).toEqual([]);
    // Revue désactivée : la place est libre
    expect(await syncTaskNotifications(task, { ...NO_QUIET, weeklyReview: false }, NOW)).toHaveLength(1);
  });

  it("un réglage de la revue modifié reprogramme les notifications", () => {
    const key = notificationSettingsKey(DEFAULT_SETTINGS);
    expect(notificationSettingsKey({ ...DEFAULT_SETTINGS, weeklyReview: false })).not.toBe(key);
    expect(notificationSettingsKey({ ...DEFAULT_SETTINGS, weeklyReviewDay: 3 })).not.toBe(key);
    expect(notificationSettingsKey({ ...DEFAULT_SETTINGS, weeklyReviewTime: "09:00" })).not.toBe(key);
  });
});

describe("appui sur la notification de revue", () => {
  it("ouvre la revue", () => {
    const handlers = { complete: jest.fn(), snooze: jest.fn(), open: jest.fn(), openReview: jest.fn() };
    const response = {
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: {
        date: NOW,
        request: { identifier: "r", content: { data: { type: "review", weekday: 1, hour: 18, minute: 0 } } },
      },
    } as unknown as Notifications.NotificationResponse;

    expect(handleNotificationResponse(response, handlers)).toBe(true);
    expect(handlers.openReview).toHaveBeenCalledTimes(1);
    expect(handlers.open).not.toHaveBeenCalled();
  });
});

describe("réglages de la revue", () => {
  it("valeurs enregistrées avant la 1.2 ou invalides : dimanche 18 h, activée", () => {
    const before = JSON.stringify({ schemaVersion: 1, settings: { doNagInterval: 30 } });
    expect(parseSettings(before)).toMatchObject({
      weeklyReview: true,
      weeklyReviewDay: 0,
      weeklyReviewTime: "18:00",
    });
    const invalid = JSON.stringify({
      schemaVersion: 1,
      settings: { weeklyReview: "oui", weeklyReviewDay: 9, weeklyReviewTime: "25:00" },
    });
    expect(parseSettings(invalid)).toMatchObject({
      weeklyReview: true,
      weeklyReviewDay: 0,
      weeklyReviewTime: "18:00",
    });
    const saved = JSON.stringify({
      schemaVersion: 1,
      settings: { weeklyReview: false, weeklyReviewDay: 5, weeklyReviewTime: "17:30" },
    });
    expect(parseSettings(saved)).toMatchObject({
      weeklyReview: false,
      weeklyReviewDay: 5,
      weeklyReviewTime: "17:30",
    });
  });

  const renderForm = async (settings: Settings) => {
    const onChange = jest.fn();
    await render(
      <SettingsForm
        settings={settings}
        onChange={onChange}
        permission="granted"
        onRequestPermission={() => {}}
        onOpenSystemSettings={() => {}}
        archivedTasks={[]}
        onRestore={() => {}}
        onDeleteForever={() => {}}
        onOpenReview={() => {}}
      />
    );
    return onChange;
  };

  it("activer / désactiver, choisir le jour, avec un « i »", async () => {
    const onChange = await renderForm(DEFAULT_SETTINGS);
    expect(screen.getByLabelText("En savoir plus : Rappel de la revue")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Dim" })).toBeSelected();

    await fireEvent.press(screen.getByRole("radio", { name: "Ven" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, weeklyReviewDay: 5 });

    await fireEvent(screen.getByLabelText("Me rappeler chaque semaine"), "valueChange", false);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, weeklyReview: false });
  });

  it("désactivée : jour et heure masqués, la revue reste accessible", async () => {
    await renderForm({ ...DEFAULT_SETTINGS, weeklyReview: false });
    expect(screen.queryByRole("radio", { name: "Dim" })).toBeNull();
    expect(screen.getByRole("button", { name: "Faire la revue maintenant" })).toBeOnTheScreen();
  });
});
