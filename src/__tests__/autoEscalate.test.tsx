import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import EscalationNotice from "../components/EscalationNotice";
import SettingsForm from "../components/SettingsForm";
import TaskChips from "../components/TaskChips";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { isLate, shouldEscalate } from "../notifications/status";
import { withAnchors } from "../recurrence";
import { DEFAULT_SETTINGS, parseSettings, Settings, SETTINGS_KEY } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TasksProvider, TasksState, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  quietHoursStart: "00:00",
  quietHoursEnd: "00:00",
  weeklyReview: false,
};

const scheduled = () =>
  (Notifications as unknown as {
    __state: { scheduled: { content: { data: { taskId: string; type: string } } }[] };
  }).__state.scheduled;

const planned = (overrides: Partial<Task> = {}) =>
  makeTask({
    id: "p",
    title: "Préparer la réunion",
    category: "INU",
    dueAt: Date.now() - HOUR,
    reminderOffset: 60,
    ...overrides,
  });

const launch = async (tasks: Task[], settings: Settings = SETTINGS) => {
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
  const hook = await renderHook(({ s }: { s: Settings }) => useTasks(s), { initialProps: { s: settings } });
  await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
  await act(async () => {});
  return hook;
};

describe("tâches concernées", () => {
  const now = Date.now();

  it("seulement « Planifier », pas terminée, échéance dépassée", () => {
    expect(shouldEscalate(planned({ dueAt: now - 1 }), now)).toBe(true);
    expect(shouldEscalate(planned({ dueAt: now }), now)).toBe(true); // à l'heure de l'échéance
    expect(shouldEscalate(planned({ dueAt: now + 1 }), now)).toBe(false);
    expect(shouldEscalate(planned({ isDone: true }), now)).toBe(false);
    expect(shouldEscalate(planned({ archivedAt: 1 }), now)).toBe(false);
    expect(shouldEscalate(planned({ category: "UDI" }), now)).toBe(false);
  });

  it("sans échéance : jamais", () => {
    expect(shouldEscalate(planned({ dueAt: null }), now)).toBe(false);
    expect(isLate(planned({ dueAt: null }), now)).toBe(false);
  });

  it("bascule annulée pour cette échéance : plus jamais, sauf nouvelle échéance", () => {
    const due = now - HOUR;
    expect(shouldEscalate(planned({ dueAt: due, escalationSkippedFor: due }), now)).toBe(false);
    expect(shouldEscalate(planned({ dueAt: due - HOUR, escalationSkippedFor: due }), now)).toBe(true);
  });
});

describe("bascule automatique", () => {
  beforeEach(() => AsyncStorage.clear());

  it("au démarrage : passe en Faire, garde l'échéance, relances reprogrammées sans doublon", async () => {
    const { result } = await launch([planned(), makeTask({ id: "x", category: "INU", dueAt: null })]);

    const task = result.current.tasks[0];
    expect(task).toMatchObject({ category: "UI", nagInterval: SETTINGS.doNagInterval });
    expect(task.dueAt).not.toBeNull(); // puce « En retard »
    expect(task.updatedAt).toBeGreaterThan(Date.now() - 5000); // les relances partent de maintenant
    expect(result.current.tasks[1].category).toBe("INU"); // sans échéance : jamais
    expect(result.current.escalation?.before.map((t) => t.id)).toEqual(["p"]);

    // Notifications de « Faire » seulement : plus de rappel ni d'échéance de « Planifier »
    await waitFor(() =>
      expect(scheduled().filter((n) => n.content.data.taskId === "p").map((n) => n.content.data.type)).toEqual([
        "nag",
      ])
    );
  });

  it("à l'heure de l'échéance, si l'app est ouverte", async () => {
    const { result } = await launch([planned({ dueAt: Date.now() + 400 })]);
    expect(result.current.tasks[0].category).toBe("INU");
    await waitFor(() => expect(result.current.tasks[0].category).toBe("UI"), { timeout: 3000 });
    expect(result.current.escalation).not.toBeNull();
  });

  it("au retour dans l'app", async () => {
    const listeners: ((state: string) => void)[] = [];
    const spy = jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, l: (s: string) => void) => {
      listeners.push(l);
      return { remove: jest.fn() };
    }) as never);
    try {
      // Échéance lointaine : rien au démarrage
      const { result, unmount } = await launch([planned({ dueAt: Date.now() + 10 * DAY })]);
      // L'échéance est passée pendant que l'app était en arrière-plan
      await act(() => result.current.updateTask("p", { dueAt: Date.now() + 10 * DAY }));
      expect(result.current.tasks[0].category).toBe("INU");
      jest.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * DAY);
      await act(async () => listeners.forEach((l) => l("active")));
      await waitFor(() => expect(result.current.tasks[0].category).toBe("UI"));
      // Laisse finir la réconciliation des notifications déclenchée par le retour
      await act(() => new Promise((r) => setTimeout(r, 100)));
      await unmount();
    } finally {
      // AppState.addEventListener est déjà un mock dans Jest : mockRestore lui retirerait son
      // implémentation, on remet un abonnement neutre
      spy.mockImplementation((() => ({ remove: jest.fn() })) as never);
      (Date.now as jest.Mock).mockRestore?.();
    }
  });

  it("« Annuler » la remet en Planifier, telle qu'elle était, sans rebasculer", async () => {
    const before = planned();
    const { result } = await launch([before]);
    expect(result.current.tasks[0].category).toBe("UI");

    await act(() => result.current.undoEscalation());
    expect(result.current.tasks[0]).toMatchObject({
      category: "INU",
      reminderOffset: 60,
      dueAt: before.dueAt,
      nagInterval: null,
      escalationSkippedFor: before.dueAt,
    });
    expect(result.current.escalation).toBeNull();
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.tasks[0].category).toBe("INU");
  });

  it("réglage désactivé : rien ne bascule ; réactivé : la tâche bascule", async () => {
    const { result, rerender } = await launch([planned()], { ...SETTINGS, autoEscalate: false });
    expect(result.current.tasks[0].category).toBe("INU");
    expect(result.current.escalation).toBeNull();

    await rerender({ s: SETTINGS });
    await waitFor(() => expect(result.current.tasks[0].category).toBe("UI"));
  });

  it("tâche récurrente : bascule avec sa répétition, la suivante revient dans Planifier", async () => {
    const dueAt = Date.now() - HOUR;
    const { result } = await launch([planned({ dueAt, recurrence: withAnchors({ freq: "weekly" }, dueAt) })]);
    expect(result.current.tasks[0]).toMatchObject({ category: "UI", recurrence: expect.any(Object) });

    await act(() => result.current.toggleDone("p"));
    expect(result.current.tasks[1]).toMatchObject({ category: "INU", reminderOffset: 60, isDone: false });
    // Le journal enregistre la catégorie au moment où la tâche est terminée
    expect(result.current.completions[0].category).toBe("UI");
  });
});

describe("notification d'échéance", () => {
  it("annonce la bascule quand elle est activée, propose « Passer en Faire » sinon", () => {
    const { computeSchedule } = require("../notifications/schedule");
    const task = planned({ dueAt: Date.now() + DAY, reminderOffset: 0 });
    const body = (s: Settings) => computeSchedule(task, s, Date.now())[0].content.body;
    expect(body(SETTINGS)).toBe("Échéance atteinte : la tâche passe en Faire.");
    expect(body({ ...SETTINGS, autoEscalate: false })).toBe("Échéance atteinte, passer en Faire ?");
  });
});

describe("puce et message", () => {
  const METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 40, left: 0, right: 0, bottom: 20 },
  };

  beforeEach(() => AsyncStorage.clear());

  it("puce « En retard »", async () => {
    await render(
      <TaskChips task={makeTask({ category: "UI", dueAt: Date.now() - HOUR })} category={CATEGORY_BY_KEY.UI} />
    );
    expect(screen.getByText("En retard")).toBeOnTheScreen();
  });

  it("« 1 tâche planifiée est passée en Faire », avec « Annuler »", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([planned()]));
    let state: TasksState | undefined;
    const Grab = () => {
      state = useTasksSelector((s) => s);
      return null;
    };
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <EscalationNotice />
          <Grab />
        </TasksProvider>
      </SafeAreaProvider>
    );
    expect(await screen.findByText("1 tâche planifiée est passée en Faire")).toBeOnTheScreen();
    expect(state!.tasks[0].category).toBe("UI");

    await fireEvent.press(screen.getByRole("button", { name: "Annuler : 1 tâche planifiée est passée en Faire" }));
    expect(screen.queryByText("1 tâche planifiée est passée en Faire")).toBeNull();
    expect(state!.tasks[0].category).toBe("INU");
  });

  it("pluriel", () => {
    const { t } = require("../i18n");
    expect(t.escalation.escalated(2)).toBe("2 tâches planifiées sont passées en Faire");
  });
});

describe("réglage « Basculer les tâches en retard dans Faire »", () => {
  it("activé par défaut, aussi pour les réglages enregistrés avant", () => {
    expect(DEFAULT_SETTINGS.autoEscalate).toBe(true);
    expect(parseSettings(JSON.stringify({ schemaVersion: 1, settings: { doNagInterval: 30 } })).autoEscalate).toBe(true);
    expect(
      parseSettings(JSON.stringify({ schemaVersion: 1, settings: { autoEscalate: false } })).autoEscalate
    ).toBe(false);
    expect(SETTINGS_KEY).toBe("SETTINGS");
  });

  it("interrupteur avec un « i »", async () => {
    const onChange = jest.fn();
    await render(
      <SettingsForm
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        permission="granted"
        onRequestPermission={() => {}}
        onOpenSystemSettings={() => {}}
        archivedTasks={[]}
        onRestore={() => {}}
        onDeleteForever={() => {}}
      />
    );
    expect(screen.getByLabelText("En savoir plus : Tâches en retard")).toBeOnTheScreen();
    await fireEvent(screen.getByLabelText("Basculer les tâches en retard dans Faire"), "valueChange", false);
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, autoEscalate: false });
  });
});

describe("tâche remise à la main dans « Planifier » avec une échéance passée", () => {
  beforeEach(() => AsyncStorage.clear());

  // Tâche déjà basculée dans « Faire », échéance passée
  const escalated = () =>
    planned({ category: "UI", nagInterval: 120, reminderOffset: null, dueAt: Date.now() - HOUR });
  const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 100)));

  it("menu « Déplacer » : elle reste dans « Planifier »", async () => {
    const { result } = await launch([escalated()]);
    await act(() => result.current.moveTask("p", "INU"));
    await settle();
    expect(result.current.tasks[0]).toMatchObject({
      category: "INU",
      escalationSkippedFor: result.current.tasks[0].dueAt,
    });
    expect(result.current.escalation).toBeNull();
  });

  it("fiche ou « Annuler » d'un déplacement : elle reste dans « Planifier »", async () => {
    const { result } = await launch([escalated()]);
    await act(() => result.current.updateTask("p", { category: "INU" }));
    await settle();
    expect(result.current.tasks[0].category).toBe("INU");
  });

  it("une nouvelle échéance passée plus tard la fera basculer à nouveau", async () => {
    const { result } = await launch([escalated()]);
    await act(() => result.current.moveTask("p", "INU"));
    await act(() => result.current.updateTask("p", { dueAt: Date.now() + 300 }));
    await waitFor(() => expect(result.current.tasks[0].category).toBe("UI"), { timeout: 3000 });
  });
});
