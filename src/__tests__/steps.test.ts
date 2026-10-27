import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { buildBackup, parseBackup } from "../backup";
import { useTasks } from "../hooks/useTasks";
import { en } from "../i18n/en";
import { parseStoredTasks, serializeTasks } from "../migrations";
import { computeSchedule } from "../notifications/schedule";
import {
  MAX_SCHEDULED,
  reconcileNotifications,
  STEP_CATEGORY_ID,
  syncTaskNotifications,
} from "../notifications/service";
import { ACTION_DONE, ACTION_POSTPONE, configureNotifications, handleNotificationResponse } from "../notifications/setup";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { addDays, dayKey } from "../dates";
import { sessionDays, splitSessions } from "../sessions";
import {
  isStepLate,
  makeStep,
  moveStep,
  parseSteps,
  resetSteps,
  stepProgress,
  stepReminderDate,
  todayStep,
} from "../steps";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";
import { TaskStep } from "../types";

const NOW = new Date(2026, 9, 22, 10).getTime(); // jeudi 22 octobre 2026, 10 h
const TODAY = "2026-10-22";
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const NO_QUIET: Settings = { ...DEFAULT_SETTINGS, quietHoursEnabled: false, weeklyReview: false };

const step = (over: Partial<TaskStep> = {}): TaskStep => ({
  id: "s1",
  title: "Rédiger l'intro",
  done: false,
  doneAt: null,
  day: null,
  time: null,
  ...over,
});

const mock = Notifications as unknown as {
  __state: { scheduled: { identifier: string; content: any; trigger: any }[]; categories: Record<string, any[]> };
};

describe("migration v7", () => {
  const v6 = {
    schemaVersion: 6,
    tasks: [{ id: "a", title: "Exposé", category: "INU", isDone: false, createdAt: 1, updatedAt: 1 }],
  };

  it("étapes vides par défaut, copie TASKS_4COLS_BACKUP_V6 avant la migration", async () => {
    await AsyncStorage.clear();
    const original = JSON.stringify(v6);
    await AsyncStorage.setItem(STORAGE_KEY, original);
    const { loadTasks } = require("../storage");
    const tasks = await loadTasks();
    expect(tasks[0].steps).toEqual([]);
    expect(await AsyncStorage.getItem("TASKS_4COLS_BACKUP_V6")).toBe(original);
  });

  it("relit les étapes enregistrées et répare les entrées invalides", () => {
    const stored = {
      schemaVersion: 7,
      tasks: [
        {
          ...v6.tasks[0],
          steps: [
            { id: "x", title: "Plan", done: true, doneAt: 5, day: "2026-10-23", time: "14:30" },
            { id: "x", title: 42, done: "oui", doneAt: 9, day: "2026-02-30", time: "25:00" },
            "pas un objet",
          ],
        },
      ],
    };
    const { tasks } = parseStoredTasks(JSON.stringify(stored), NOW);
    expect(tasks[0].steps).toEqual([
      { id: "x", title: "Plan", done: true, doneAt: 5, day: "2026-10-23", time: "14:30" },
      // Identifiant en double renommé, titre converti, jour et heure invalides retirés
      { id: "x-1", title: "42", done: false, doneAt: null, day: null, time: null },
    ]);
  });

  it("enregistrées en v7, relues à l'identique", () => {
    const tasks = [makeTask({ steps: [step({ day: TODAY, time: "18:00" })] })];
    const json = serializeTasks(tasks);
    expect(JSON.parse(json).schemaVersion).toBe(7);
    expect(parseStoredTasks(json, NOW).tasks[0].steps).toEqual(tasks[0].steps);
  });
});

describe("étapes", () => {
  it("progression, étape du jour, retard", () => {
    const steps = [
      step({ id: "a", done: true, doneAt: 1, day: "2026-10-20" }),
      step({ id: "b", title: "Relire", day: "2026-10-21" }),
      step({ id: "c", title: "Envoyer", day: TODAY }),
    ];
    expect(stepProgress(steps)).toEqual({ done: 1, total: 3 });
    expect(stepProgress([])).toBeNull();
    expect(todayStep(steps, NOW)?.id).toBe("c");
    // Jour passé non fait : en retard ; fait, ou aujourd'hui : non
    expect(steps.map((s) => isStepLate(s, NOW))).toEqual([false, true, false]);
  });

  it("réordonnancement", () => {
    const steps = ["a", "b", "c"].map((id) => step({ id }));
    expect(moveStep(steps, 0, 2).map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(moveStep(steps, 2, 0).map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(moveStep(steps, 1, 9).map((s) => s.id)).toEqual(["a", "c", "b"]);
    expect(moveStep(steps, 1, 1)).toBe(steps);
  });

  it("place au lâcher d'après les positions mesurées, lignes de hauteurs différentes comprises", () => {
    const { dropIndex } = require("../steps");
    // Écart de 6 px entre les lignes ; la 2e a son jour ouvert
    const rows = [
      { y: 0, height: 52 },
      { y: 58, height: 180 },
      { y: 244, height: 52 },
      { y: 302, height: 52 },
    ];
    expect(dropIndex(rows, 0, 20)).toBe(0); // pas assez loin
    expect(dropIndex(rows, 0, 130)).toBe(1); // passe le milieu de la 2e (148)
    expect(dropIndex(rows, 0, 250)).toBe(2);
    expect(dropIndex(rows, 0, 400)).toBe(3);
    expect(dropIndex(rows, 3, -300)).toBe(1); // milieu à 28 : juste sous celui de la 1re (26)
    expect(dropIndex(rows, 3, -310)).toBe(0);
    expect(dropIndex(rows, 2, -60)).toBe(2); // reste sous la ligne haute
    expect(dropIndex(rows, 2, -130)).toBe(1);
  });

  it("rappel le jour prévu, à 9:00 par défaut ou à son heure", () => {
    expect(stepReminderDate(step({ day: "2026-10-23" }))).toBe(at(23, 9));
    expect(stepReminderDate(step({ day: "2026-10-23", time: "18:30" }))).toBe(at(23, 18, 30));
    expect(stepReminderDate(step())).toBeNull();
  });
});

describe("répartir sur plusieurs jours", () => {
  it("« Séance 1/5 · 1 h » … un jour chacune, à partir de demain", () => {
    const sessions = splitSessions({ count: 5, minutes: 60, from: "tomorrow", weekdaysOnly: false }, NOW);
    expect(sessions.map((s) => s.title)).toEqual([
      "Séance 1/5 · 1 h",
      "Séance 2/5 · 1 h",
      "Séance 3/5 · 1 h",
      "Séance 4/5 · 1 h",
      "Séance 5/5 · 1 h",
    ]);
    expect(sessions.map((s) => s.day)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    expect(sessions.every((s) => !s.done && s.time === null)).toBe(true);
    expect(new Set(sessions.map((s) => s.id)).size).toBe(5);
  });

  it("jours de semaine seulement : le week-end est sauté", () => {
    // Vendredi 23, puis lundi 26 et mardi 27
    expect(sessionDays({ count: 3, minutes: 30, from: "tomorrow", weekdaysOnly: true }, NOW)).toEqual([
      "2026-10-23",
      "2026-10-26",
      "2026-10-27",
    ]);
    // Commencée un samedi : lundi en premier
    const saturday = at(24, 10);
    expect(sessionDays({ count: 2, minutes: 30, from: "today", weekdaysOnly: true }, saturday)).toEqual([
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  it("à partir d'aujourd'hui, durées 30 min et 2 h, de 2 à 14 séances", () => {
    const today = splitSessions({ count: 2, minutes: 30, from: "today", weekdaysOnly: false }, NOW);
    expect(today.map((s) => [s.title, s.day])).toEqual([
      ["Séance 1/2 · 30 min", TODAY],
      ["Séance 2/2 · 30 min", "2026-10-23"],
    ]);
    expect(splitSessions({ count: 20, minutes: 120, from: "today", weekdaysOnly: false }, NOW)).toHaveLength(14);
    expect(splitSessions({ count: 1, minutes: 120, from: "today", weekdaysOnly: false }, NOW)[0].title).toBe(
      "Séance 1/2 · 2 h"
    );
  });

  it("changement d'heure : un jour par séance, sans doublon ni trou", () => {
    // Passage à l'heure d'hiver la nuit du 24 au 25 octobre 2026
    const days = sessionDays({ count: 4, minutes: 60, from: "today", weekdaysOnly: false }, at(24, 23, 30));
    expect(days).toEqual(["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("anglais", () => {
    expect(en.steps.session(1, 5, en.steps.durations[60])).toBe("Session 1/5 · 1 h");
  });

  it("exemple du « i » : 5 séances à partir d'un jeudi, en semaine seulement", () => {
    const { fr } = require("../i18n/fr");
    expect(fr.help.info.splitSessions.example).toBe(
      "5 séances d'1 h à partir d'un jeudi, en semaine seulement : jeudi, vendredi, lundi, mardi et mercredi."
    );
    expect(en.help.info.splitSessions.example).toBe(
      "5 one-hour sessions starting on a Thursday, weekdays only: Thursday, Friday, Monday, Tuesday and Wednesday."
    );
    // L'exemple correspond au calcul : jeudi 22, vendredi 23, lundi 26, mardi 27, mercredi 28
    expect(sessionDays({ count: 5, minutes: 60, from: "today", weekdaysOnly: true }, NOW)).toEqual([
      "2026-10-22",
      "2026-10-23",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });
});

describe("rappels d'étape", () => {
  beforeEach(() => jest.clearAllMocks());

  it("un rappel le jour prévu, avec « Fait » et « Reporter à demain »", async () => {
    await configureNotifications();
    expect(mock.__state.categories[STEP_CATEGORY_ID].map((a: any) => [a.identifier, a.buttonTitle])).toEqual([
      [ACTION_DONE, "Fait"],
      [ACTION_POSTPONE, "Reporter à demain"],
    ]);

    const task = makeTask({
      id: "t",
      title: "Exposé",
      category: "INU",
      steps: [step({ id: "a", day: "2026-10-23" }), step({ id: "b", title: "Relire", day: "2026-10-24", time: "14:00" })],
    });
    await syncTaskNotifications(task, NO_QUIET, NOW);
    expect(
      mock.__state.scheduled.map((n) => [n.trigger.date, n.content.body, n.content.categoryIdentifier, n.content.data.stepId])
    ).toEqual([
      [at(23, 9), "Étape du jour : Rédiger l'intro", STEP_CATEGORY_ID, "a"],
      [at(24, 14), "Étape du jour : Relire", STEP_CATEGORY_ID, "b"],
    ]);
  });

  it("rien pour une étape faite, sans jour, déjà passée, ni pour une tâche terminée", () => {
    const steps = [
      step({ id: "done", done: true, doneAt: 1, day: "2026-10-23" }),
      step({ id: "noday" }),
      step({ id: "past", day: TODAY, time: "08:00" }),
      step({ id: "ok", day: TODAY, time: "18:00" }),
    ];
    const items = computeSchedule(makeTask({ category: "UI", steps }), NO_QUIET, NOW);
    expect(items.map((i) => i.stepId)).toEqual(["ok"]);
    expect(computeSchedule(makeTask({ category: "UI", isDone: true, steps }), NO_QUIET, NOW)).toEqual([]);
  });

  it("aussi dans « Si j'ai le temps » (qui n'a sinon aucun rappel)", () => {
    const task = makeTask({ category: "NDNI", timerEnd: at(22, 11), steps: [step({ day: "2026-10-23" })] });
    expect(computeSchedule(task, NO_QUIET, NOW).map((i) => i.type)).toEqual(["step"]);
  });

  it("respecte la plage silencieuse", () => {
    const task = makeTask({ steps: [step({ day: TODAY, time: "23:00" })] });
    const quiet = { ...NO_QUIET, quietHoursEnabled: true }; // 22:00 → 08:00
    expect(computeSchedule(task, quiet, NOW)[0].date).toBe(at(23, 8));
  });

  it("plafond iOS de 64 : seuls les plus proches sont programmés", async () => {
    const steps = Array.from({ length: 80 }, (_, i) =>
      step({ id: `s${i}`, title: `Séance ${i}`, day: addDays(TODAY, i + 1) })
    );
    const result = await reconcileNotifications([makeTask({ id: "t", steps })], NO_QUIET, NOW);
    expect(mock.__state.scheduled).toHaveLength(MAX_SCHEDULED);
    expect(result.t).toHaveLength(MAX_SCHEDULED);
    expect(mock.__state.scheduled.at(-1)!.content.data.stepId).toBe("s63");
  });

  it("réconciliation : un rappel d'étape déjà programmé est gardé tel quel", async () => {
    const task = makeTask({ id: "t", steps: [step({ day: "2026-10-23" })] });
    await reconcileNotifications([task], NO_QUIET, NOW);
    const id = mock.__state.scheduled[0].identifier;
    await reconcileNotifications([task], NO_QUIET, NOW);
    expect(mock.__state.scheduled.map((n) => n.identifier)).toEqual([id]);
  });

  it("réponses : « Fait » coche l'étape, « Reporter à demain » la décale, un appui ouvre la tâche", () => {
    const handlers = {
      complete: jest.fn(),
      snooze: jest.fn(),
      open: jest.fn(),
      completeStep: jest.fn(),
      postponeStep: jest.fn(),
    };
    const response = (actionIdentifier: string) =>
      ({
        actionIdentifier,
        notification: {
          date: NOW,
          request: { identifier: "n", content: { data: { taskId: "t", stepId: "a", type: "step" } } },
        },
      }) as unknown as Notifications.NotificationResponse;

    handleNotificationResponse(response(ACTION_DONE), handlers);
    expect(handlers.completeStep).toHaveBeenCalledWith("t", "a");
    expect(handlers.complete).not.toHaveBeenCalled();
    handleNotificationResponse(response(ACTION_POSTPONE), handlers);
    expect(handlers.postponeStep).toHaveBeenCalledWith("t", "a");
    handleNotificationResponse(response(Notifications.DEFAULT_ACTION_IDENTIFIER), handlers);
    expect(handlers.open).toHaveBeenCalledWith("t");
  });
});

describe("dans useTasks", () => {
  const launch = async (tasks: ReturnType<typeof makeTask>[]) => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    const hook = await renderHook(() => useTasks(NO_QUIET));
    await waitFor(() => expect(hook.result.current.isLoaded).toBe(true));
    return hook;
  };
  let now: jest.SpyInstance;
  beforeEach(() => {
    now = jest.spyOn(Date, "now").mockReturnValue(NOW);
  });
  afterEach(() => now.mockRestore());

  it("ajout avec étapes, cochage, « Fait » et « Reporter à demain » sans toucher aux relances", async () => {
    const { result } = await launch([]);
    await act(() =>
      result.current.addTask({ title: "Exposé", category: "UI", steps: [step({ id: "a" }), step({ id: "b", day: TODAY })] })
    );
    const id = result.current.tasks[0].id;
    const updatedAt = result.current.tasks[0].updatedAt;

    await act(() => result.current.toggleStep(id, "a"));
    expect(result.current.tasks[0].steps![0]).toMatchObject({ done: true, doneAt: NOW });
    await act(() => result.current.toggleStep(id, "a"));
    expect(result.current.tasks[0].steps![0]).toMatchObject({ done: false, doneAt: null });

    await act(() => result.current.postponeStep(id, "b"));
    expect(result.current.tasks[0].steps![1].day).toBe("2026-10-23");
    await act(() => result.current.completeStep(id, "b"));
    await act(() => result.current.completeStep(id, "b")); // déjà faite : rien ne change
    expect(result.current.tasks[0].steps![1].done).toBe(true);
    expect(result.current.tasks[0].updatedAt).toBe(updatedAt);
  });

  it("le journal ne compte que les tâches terminées, pas les étapes", async () => {
    const { result } = await launch([makeTask({ id: "t", steps: [step({ id: "a" }), step({ id: "b" })] })]);
    await act(() => result.current.toggleStep("t", "a"));
    await act(() => result.current.toggleStep("t", "b"));
    expect(result.current.completions).toHaveLength(0);
    await act(() => result.current.toggleDone("t"));
    expect(result.current.completions).toHaveLength(1);
  });

  it("tâche récurrente : l'occurrence suivante reprend les étapes, décochées, sans jour prévu", async () => {
    const steps = [
      step({ id: "a", done: true, doneAt: 1, day: "2026-10-20" }),
      step({ id: "b", title: "Relire", day: TODAY, time: "18:00" }),
    ];
    const { result } = await launch([
      makeTask({ id: "r", category: "INU", dueAt: at(22, 18), recurrence: { freq: "weekly", days: [4] }, steps }),
    ]);
    await act(() => result.current.toggleDone("r"));
    const next = result.current.tasks[1];
    expect(next.id).not.toBe("r");
    expect(next.steps).toEqual(resetSteps(steps));
    expect(next.steps!.map((s) => [s.title, s.done, s.day])).toEqual([
      ["Rédiger l'intro", false, null],
      ["Relire", false, null],
    ]);
    // La tâche terminée garde ses étapes telles quelles
    expect(result.current.tasks[0].steps).toEqual(steps);
  });
});

describe("sauvegarde et import", () => {
  it("les étapes sont exportées et réimportées, validées", () => {
    const steps = [step({ day: "2026-10-23", time: "07:45" }), makeStep("Relire")];
    const file = buildBackup(
      { tasks: [makeTask({ steps })], settings: DEFAULT_SETTINGS, completions: [], reviewWeeks: [] },
      NOW
    ) as unknown as { tasks: { schemaVersion: number; tasks: Record<string, unknown>[] } };
    expect(file.tasks.schemaVersion).toBe(7);
    const parsed = parseBackup(JSON.stringify(file), NOW);
    expect(parsed.ok && parsed.backup.tasks[0].steps).toEqual(steps);

    // Étapes invalides dans le fichier : réparées, pas de refus
    const broken = { ...file, tasks: { ...file.tasks, tasks: [{ ...file.tasks.tasks[0], steps: [{ title: "x", day: "demain" }, 3] }] } };
    const fixed = parseBackup(JSON.stringify(broken), NOW);
    expect(fixed.ok && fixed.backup.tasks[0].steps).toEqual(parseSteps([{ title: "x", day: "demain" }]));
    expect(fixed.ok && fixed.backup.tasks[0].steps![0].day).toBeNull();
  });

  it("une sauvegarde v6 (sans étapes) s'importe", () => {
    const v6 = {
      app: "dofirst",
      backupVersion: 1,
      tasks: { schemaVersion: 6, tasks: [{ id: "a", title: "Ancienne", category: "UI" }] },
    };
    const parsed = parseBackup(JSON.stringify(v6), NOW);
    expect(parsed.ok && parsed.backup.tasks[0].steps).toEqual([]);
  });
});

it("jour local", () => {
  expect(dayKey(NOW)).toBe(TODAY);
});

describe("étapes datées et autorisation des notifications", () => {
  it("hasReminder : une étape non faite avec un jour suffit", () => {
    const { hasReminder, EMPTY_REMINDER_FIELDS } = require("../reminders");
    expect(hasReminder("NDNI", EMPTY_REMINDER_FIELDS, [step({ day: TODAY })])).toBe(true);
    expect(hasReminder("NDNI", EMPTY_REMINDER_FIELDS, [step({ day: TODAY, done: true, doneAt: 1 })])).toBe(false);
    expect(hasReminder("NDNI", EMPTY_REMINDER_FIELDS, [step()])).toBe(false);
    expect(hasReminder("NDNI", EMPTY_REMINDER_FIELDS)).toBe(false);
  });
});
