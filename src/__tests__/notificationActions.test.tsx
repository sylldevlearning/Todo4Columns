import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { AppState } from "react-native";
import TaskForm from "../components/TaskForm";
import { useTasks } from "../hooks/useTasks";
import { CATEGORY_ID } from "../notifications/service";
import {
  ACTION_DONE,
  ACTION_OPEN,
  ACTION_SNOOZE,
  configureNotifications,
  ensurePermission,
  handleNotificationResponse,
} from "../notifications/setup";
import {
  HANDLED_RESPONSE_KEY,
  useNotificationResponses,
} from "../notifications/useNotificationResponses";
import { DEFAULT_SETTINGS } from "../settings";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

const mock = Notifications as unknown as {
  __state: { permission: string; requestResult?: string; categories: any; lastResponse: any };
  __emitResponse: (r: unknown) => void;
};

const response = (actionIdentifier: string, taskId = "a", identifier = "n1") =>
  ({
    actionIdentifier,
    notification: {
      date: 1,
      request: { identifier, content: { data: { taskId, type: "nag", date: 2 } } },
    },
  }) as unknown as Notifications.NotificationResponse;

describe("configuration", () => {
  it("crée les boutons « Fait », « Reporter 1 h », « Ouvrir »", async () => {
    await configureNotifications();
    expect(mock.__state.categories[CATEGORY_ID].map((a: any) => a.buttonTitle)).toEqual([
      "Fait",
      "Reporter 1 h",
      "Ouvrir",
    ]);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("ne demande l'autorisation qu'une fois, si elle n'a jamais été demandée", async () => {
    mock.__state.permission = "undetermined";
    mock.__state.requestResult = "denied";
    expect(await ensurePermission()).toBe("denied");
    expect(await ensurePermission()).toBe("denied");
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe("handleNotificationResponse", () => {
  const handlers = () => ({ complete: jest.fn(), snooze: jest.fn(), open: jest.fn() });

  it("aiguille chaque action", () => {
    const h = handlers();
    handleNotificationResponse(response(ACTION_DONE), h);
    handleNotificationResponse(response(ACTION_SNOOZE), h);
    handleNotificationResponse(response(ACTION_OPEN), h);
    handleNotificationResponse(response(Notifications.DEFAULT_ACTION_IDENTIFIER), h);

    expect(h.complete).toHaveBeenCalledWith("a");
    expect(h.snooze).toHaveBeenCalledWith("a");
    expect(h.open).toHaveBeenCalledTimes(2);
  });

  it("ignore une notification sans tâche", () => {
    const h = handlers();
    const r = response(ACTION_DONE);
    (r.notification.request.content as any).data = {};
    expect(handleNotificationResponse(r, h)).toBe(false);
    expect(h.complete).not.toHaveBeenCalled();
  });
});

describe("useNotificationResponses", () => {
  beforeEach(() => AsyncStorage.clear());

  const options = (isLoaded = true) => ({
    isLoaded,
    tasks: [makeTask({ id: "a", category: "INU" })],
    completeTask: jest.fn(),
    snoozeTask: jest.fn(),
    openQuadrant: jest.fn(),
  });

  it("applique une action reçue pendant que l'app tourne et ouvre le quadrant au tap", async () => {
    const opts = options();
    await renderHook(() => useNotificationResponses(opts));

    await act(() => mock.__emitResponse(response(ACTION_DONE, "a", "n1")));
    await act(() => mock.__emitResponse(response(Notifications.DEFAULT_ACTION_IDENTIFIER, "a", "n2")));

    expect(opts.completeTask).toHaveBeenCalledWith("a");
    expect(opts.openQuadrant).toHaveBeenCalledWith("INU");
  });

  it("applique au démarrage l'action choisie quand l'app était fermée, une seule fois", async () => {
    mock.__state.lastResponse = response(ACTION_SNOOZE);
    const first = options();
    const hook = await renderHook(() => useNotificationResponses(first));
    await waitFor(() => expect(first.snoozeTask).toHaveBeenCalledWith("a"));
    expect(await AsyncStorage.getItem(HANDLED_RESPONSE_KEY)).not.toBeNull();
    await hook.unmount();

    // Si le système renvoie encore la même réponse au lancement suivant, elle n'est pas rejouée
    mock.__state.lastResponse = response(ACTION_SNOOZE);
    const second = options();
    await renderHook(() => useNotificationResponses(second));
    await waitFor(() => expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled());
    expect(second.snoozeTask).not.toHaveBeenCalled();
  });

  describe("célébration du bouton « Fait »", () => {
    const setAppState = (state: string) =>
      Object.defineProperty(AppState, "currentState", { value: state, configurable: true });
    afterEach(() => setAppState("active"));

    const withCelebration = () => ({ ...options(), onCompletedInApp: jest.fn() });

    it("célèbre quand l'app est à l'écran", async () => {
      setAppState("active");
      const opts = withCelebration();
      await renderHook(() => useNotificationResponses(opts));
      await act(() => mock.__emitResponse(response(ACTION_DONE)));

      expect(opts.completeTask).toHaveBeenCalledWith("a");
      expect(opts.onCompletedInApp).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    });

    it("ne célèbre pas quand l'app est en arrière-plan", async () => {
      setAppState("background");
      const opts = withCelebration();
      await renderHook(() => useNotificationResponses(opts));
      await act(() => mock.__emitResponse(response(ACTION_DONE)));

      expect(opts.completeTask).toHaveBeenCalledWith("a");
      expect(opts.onCompletedInApp).not.toHaveBeenCalled();
    });

    it("ne célèbre pas une tâche validée pendant que l'app était fermée", async () => {
      setAppState("active");
      mock.__state.lastResponse = response(ACTION_DONE);
      const opts = withCelebration();
      await renderHook(() => useNotificationResponses(opts));

      await waitFor(() => expect(opts.completeTask).toHaveBeenCalledWith("a"));
      expect(opts.onCompletedInApp).not.toHaveBeenCalled();
    });

    it("ne célèbre pas une tâche déjà terminée", async () => {
      const opts = { ...withCelebration(), tasks: [makeTask({ id: "a", isDone: true })] };
      await renderHook(() => useNotificationResponses(opts));
      await act(() => mock.__emitResponse(response(ACTION_DONE)));
      expect(opts.onCompletedInApp).not.toHaveBeenCalled();
    });
  });

  it("attend le chargement des tâches avant d'appliquer une action", async () => {
    const opts = options(false);
    const hook = await renderHook((p: ReturnType<typeof options>) => useNotificationResponses(p), {
      initialProps: opts,
    });
    await act(() => mock.__emitResponse(response(ACTION_DONE)));
    expect(opts.completeTask).not.toHaveBeenCalled();

    await hook.rerender({ ...opts, isLoaded: true });
    await waitFor(() => expect(opts.completeTask).toHaveBeenCalledWith("a"));
  });
});

describe("actions sur les tâches", () => {
  beforeEach(() => AsyncStorage.clear());

  const setup = async () => {
    const hook = await renderHook(() => useTasks());
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull());
    await act(() => hook.result.current.addTask({ title: "Appeler", category: "UI", nagInterval: 30 }));
    return hook;
  };

  it("« Fait » termine la tâche sans jamais la rouvrir", async () => {
    const { result } = await setup();
    const id = result.current.tasks[0].id;

    await act(() => result.current.completeTask(id));
    await act(() => result.current.completeTask(id));
    expect(result.current.tasks[0].isDone).toBe(true);
  });

  it("« Reporter 1 h » repousse la relance sans changer le point de départ", async () => {
    const { result } = await setup();
    const before = result.current.tasks[0];

    await act(() => result.current.snoozeTask(before.id));
    const after = result.current.tasks[0];
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.snoozedUntil! - Date.now()).toBeGreaterThan(59 * 60 * 1000);
  });
});

describe("message d'autorisation refusée dans la fiche", () => {
  it("s'affiche seulement quand un rappel est prévu", async () => {
    const onOpenSettings = jest.fn();
    await render(
      <TaskForm
        initialCategory="UI"
        settings={DEFAULT_SETTINGS}
        notificationsDenied
        onOpenSettings={onOpenSettings}
        onSubmit={() => {}}
      />
    );

    await fireEvent.press(screen.getByRole("link", { name: "Ouvrir les réglages du téléphone" }));
    expect(onOpenSettings).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("radio", { name: "Jamais" }));
    expect(screen.queryByText(/notifications sont désactivées/)).toBeNull();
  });
});
