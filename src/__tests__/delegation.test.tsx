import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { AppState, AppStateStatus, Share } from "react-native";
import TaskForm from "../components/TaskForm";
import { delegationMessage, nudgeMessage, shareWhenActive } from "../delegation";
import { en } from "../i18n/en";
import { CATEGORY_ID, DELEGATE_CATEGORY_ID, reconcileNotifications, syncTaskNotifications } from "../notifications/service";
import { ACTION_NUDGE, configureNotifications, handleNotificationResponse } from "../notifications/setup";
import { useNotificationResponses } from "../notifications/useNotificationResponses";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { makeTask } from "../testing/makeTask";

const mock = Notifications as unknown as {
  __state: {
    categories: Record<string, { identifier: string; buttonTitle: string; options: { opensAppToForeground: boolean } }[]>;
    scheduled: { identifier: string; content: { categoryIdentifier?: string; data: { taskId: string } } }[];
  };
  __emitResponse: (r: unknown) => void;
};

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00", weeklyReview: false };
const NOW = new Date(2026, 9, 22, 10).getTime();
const DUE = new Date(2026, 9, 23, 17).getTime(); // vendredi 23 octobre

let share: jest.SpyInstance;
beforeEach(() => {
  share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  share.mockClear();
});

describe("messages", () => {
  it("avec un nom et une échéance", () => {
    expect(delegationMessage({ title: "Compte rendu", delegatedTo: "Marie", dueAt: DUE })).toBe(
      "Salut Marie, peux-tu t'occuper de : Compte rendu ? (avant le vendredi 23 octobre) Merci !"
    );
  });

  it("sans nom ni échéance", () => {
    expect(delegationMessage({ title: "Compte rendu", delegatedTo: null, dueAt: null })).toBe(
      "Salut, peux-tu t'occuper de : Compte rendu ? Merci !"
    );
  });

  it("avec un nom, sans échéance ; sans nom, avec échéance", () => {
    expect(delegationMessage({ title: "Devis", delegatedTo: "Sam", dueAt: null })).toBe(
      "Salut Sam, peux-tu t'occuper de : Devis ? Merci !"
    );
    expect(delegationMessage({ title: "Devis", delegatedTo: null, dueAt: DUE })).toBe(
      "Salut, peux-tu t'occuper de : Devis ? (avant le vendredi 23 octobre) Merci !"
    );
  });

  it("relance", () => {
    expect(nudgeMessage({ title: "Compte rendu" })).toBe("Petit rappel : où en es-tu pour Compte rendu ?");
  });

  it("en anglais", () => {
    expect(en.delegation.message("Maria", "Meeting notes", "Friday, October 23")).toBe(
      "Hi Maria, could you take care of: Meeting notes? (before Friday, October 23) Thanks!"
    );
    expect(en.delegation.message(null, "Meeting notes", null)).toBe(
      "Hi, could you take care of: Meeting notes? Thanks!"
    );
    expect(en.delegation.nudgeMessage("Meeting notes")).toBe("Quick reminder: how's it going with Meeting notes?");
    expect(en.delegation.send(null)).toBe("Send");
  });
});

describe("fiche « Déléguer » : « Envoyer »", () => {
  it("« Envoyer à Marie » ouvre le partage avec le message prêt, avec un « i »", async () => {
    const task = makeTask({ title: "Compte rendu", category: "UDI", delegatedTo: "Marie", nagInterval: 1440, dueAt: DUE });
    await render(<TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    expect(screen.getByLabelText("En savoir plus : Envoyer la tâche")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Envoyer à Marie" }));
    expect(share).toHaveBeenCalledWith({
      message: "Salut Marie, peux-tu t'occuper de : Compte rendu ? (avant le vendredi 23 octobre) Merci !",
    });
  });

  it("« Envoyer » sans nom ; pas de bouton sans titre", async () => {
    await render(<TaskForm initialCategory="UDI" settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Envoyer" })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Devis");
    await fireEvent.press(screen.getByRole("button", { name: "Envoyer" }));
    expect(share).toHaveBeenCalledWith({ message: "Salut, peux-tu t'occuper de : Devis ? Merci !" });
  });

  it("l'échéance facultative est enregistrée", async () => {
    const onSubmit = jest.fn();
    const task = makeTask({ title: "Devis", category: "UDI", nagInterval: 1440, dueAt: DUE });
    await render(<TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    expect(screen.getByText("Échéance (facultative)")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: "UDI", dueAt: DUE }));
  });
});

describe("action « Relancer » de la notification", () => {
  it("boutons Fait / Relancer / Reporter 1 h ; « Relancer » ouvre l'app", async () => {
    await configureNotifications();
    const actions = mock.__state.categories[DELEGATE_CATEGORY_ID];
    expect(actions.map((a) => a.buttonTitle)).toEqual(["Fait", "Relancer", "Reporter 1 h"]);
    expect(actions.find((a) => a.identifier === ACTION_NUDGE)!.options.opensAppToForeground).toBe(true);
    // Les autres tâches gardent leurs boutons
    expect(mock.__state.categories[CATEGORY_ID].map((a) => a.buttonTitle)).toEqual(["Fait", "Reporter 1 h", "Ouvrir"]);
  });

  it("seules les relances des tâches confiées ont le bouton « Relancer »", async () => {
    await syncTaskNotifications(makeTask({ id: "d", category: "UDI", updatedAt: NOW, nagInterval: 60 }), SETTINGS, NOW);
    await syncTaskNotifications(makeTask({ id: "f", category: "UI", updatedAt: NOW, nagInterval: 60 }), SETTINGS, NOW);
    const byTask = Object.fromEntries(mock.__state.scheduled.map((n) => [n.content.data.taskId, n.content.categoryIdentifier]));
    expect(byTask).toEqual({ d: DELEGATE_CATEGORY_ID, f: CATEGORY_ID });
  });

  it("une relance programmée avant la mise à jour est remplacée pour avoir le bouton", async () => {
    const task = makeTask({ id: "d", category: "UDI", updatedAt: NOW, nagInterval: 60 });
    const keep = makeTask({ id: "f", category: "UI", updatedAt: NOW, nagInterval: 60 });
    await syncTaskNotifications(keep, SETTINGS, NOW);
    await syncTaskNotifications(task, SETTINGS, NOW);
    // Comme avant la mise à jour : sans catégorie dans les données, boutons d'origine
    const old = mock.__state.scheduled.find((n) => n.content.data.taskId === "d")!;
    delete (old.content.data as { category?: string }).category;
    old.content.categoryIdentifier = CATEGORY_ID;
    const keptId = mock.__state.scheduled.find((n) => n.content.data.taskId === "f")!.identifier;

    await reconcileNotifications([task, keep], SETTINGS, NOW);
    const after = mock.__state.scheduled.find((n) => n.content.data.taskId === "d")!;
    expect(after.content.categoryIdentifier).toBe(DELEGATE_CATEGORY_ID);
    expect(after.identifier).not.toBe(old.identifier);
    expect(mock.__state.scheduled.find((n) => n.content.data.taskId === "f")!.identifier).toBe(keptId);
  });

  it("« Relancer » est aiguillé vers le message à la personne", async () => {
    await AsyncStorage.clear();
    const response = {
      actionIdentifier: ACTION_NUDGE,
      notification: { date: 1, request: { identifier: "n1", content: { data: { taskId: "d", type: "delegate", date: 2 } } } },
    } as unknown as Notifications.NotificationResponse;

    const handlers = { complete: jest.fn(), snooze: jest.fn(), open: jest.fn(), nudge: jest.fn() };
    handleNotificationResponse(response, handlers);
    expect(handlers.nudge).toHaveBeenCalledWith("d");
    expect(handlers.open).not.toHaveBeenCalled();

    const task = makeTask({ id: "d", title: "Compte rendu", category: "UDI" });
    const opts = {
      isLoaded: true,
      tasks: [task],
      completeTask: jest.fn(),
      snoozeTask: jest.fn(),
      openQuadrant: jest.fn(),
      nudge: jest.fn(),
    };
    await renderHook(() => useNotificationResponses(opts));
    await act(() => mock.__emitResponse(response));
    expect(opts.nudge).toHaveBeenCalledWith(task);
    expect(opts.completeTask).not.toHaveBeenCalled();
  });

  it("le partage s'ouvre une fois l'app au premier plan", async () => {
    const setAppState = (state: string) =>
      Object.defineProperty(AppState, "currentState", { value: state, configurable: true });
    let emit: (state: AppStateStatus) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, handler: (s: AppStateStatus) => void) => {
      emit = handler;
      return { remove };
    }) as never);
    try {
      setAppState("background");
      shareWhenActive(nudgeMessage({ title: "Compte rendu" }));
      expect(share).not.toHaveBeenCalled();
      await act(async () => emit("active"));
      expect(share).toHaveBeenCalledWith({ message: "Petit rappel : où en es-tu pour Compte rendu ?" });
      expect(remove).toHaveBeenCalled();

      setAppState("active");
      shareWhenActive("direct");
      expect(share).toHaveBeenLastCalledWith({ message: "direct" });
    } finally {
      setAppState("active");
      (AppState.addEventListener as jest.Mock).mockImplementation((() => ({ remove: jest.fn() })) as never);
    }
  });
});
