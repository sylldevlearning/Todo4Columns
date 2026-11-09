import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { COMPLETION_LOG_KEY } from "../completionLog";
import { dayKey } from "../dates";
import { setLanguagePreference } from "../i18n";
import { serializeTasks, parseStoredTasks } from "../migrations";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { getTombstones, resetTombstonesForTests } from "../sync/localChanges";
import { EMPTY_SYNC_DATA } from "../sync/merge";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";
import { Task } from "../types";
import { checkFromWidget } from "../widgets/complete";
import { doWidgetData, matrixWidgetData, nextMidnight, todayWidgetData } from "../widgets/data";
import { setLiveApp } from "../widgets/liveApp";
import { COMPLETE_ACTION } from "../widgets/links";
import { renderWidget, WIDGET_NAMES } from "../widgets/render";
import { widgetTaskHandler } from "../widgets/taskHandler";
import WidgetSync, { WIDGET_REFRESH_DELAY_MS } from "../widgets/WidgetSync";

/* eslint-disable @typescript-eslint/no-require-imports */
declare const require: (id: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
declare const __dirname: string;
const fs = require("fs");
const path = require("path");
const { buildWidgetTree } = require("react-native-android-widget/lib/commonjs/api/build-widget-tree");

// Mise à jour des widgets posés : simulée (aucun module natif dans Jest)
jest.mock("react-native-android-widget", () => ({
  ...jest.requireActual("react-native-android-widget"),
  requestWidgetUpdate: jest.fn(async () => {}),
}));
const requestUpdate = requestWidgetUpdate as jest.Mock;

const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 10, 9, 10, 0).getTime(); // lundi 9 novembre 2026, 10:00
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 10, 9 + dayOffset, h, m).getTime();

interface Node {
  type: string;
  props: Record<string, unknown>;
  children?: Node[];
}
const tree = (name: string, tasks: Task[], size = { width: 320, height: 320 }, now = NOW) =>
  buildWidgetTree(renderWidget(name, size, { tasks, settings: DEFAULT_SETTINGS, now })) as Node;
const walk = (n: Node, out: Node[] = []) => {
  out.push(n);
  (n.children ?? []).forEach((c) => walk(c, out));
  return out;
};
const texts = (n: Node) => walk(n).flatMap((x) => (typeof x.props?.text === "string" ? [x.props.text as string] : []));
const clicks = (n: Node) =>
  walk(n).flatMap((x) =>
    x.props?.clickAction ? [{ action: x.props.clickAction as string, data: x.props.clickActionData as Record<string, unknown> }] : []
  );
const uris = (n: Node) => clicks(n).filter((c) => c.action === "OPEN_URI").map((c) => c.data.uri as string);

const scheduledFor = (id: string) =>
  (Notifications as unknown as { __state: { scheduled: { content: { data: { taskId?: string } } }[] } }).__state.scheduled.filter(
    (n) => n.content.data.taskId === id
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  resetTombstonesForTests();
  setLiveApp(null);
  setLanguagePreference("fr");
  requestUpdate.mockClear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("contenu des widgets", () => {
  const doTasks = [1, 2, 3, 4, 5].map((i) => makeTask({ id: `f${i}`, title: `Tâche ${i}`, category: "UI" }));

  it("« Faire » vide : message, nombre 0, + et micro", () => {
    const t = tree("DoFirstDo", [makeTask({ id: "p", category: "INU" })]);
    expect(texts(t)).toEqual(["Faire", "  0", "Rien à faire maintenant"]);
    expect(uris(t)).toEqual(["todo4columns://quadrant/UI", "todo4columns://task?category=UI", "todo4columns://task?category=UI&voice=1"]);
  });

  it("« Faire » plein : nombre total, les 3 premières seulement, sans les terminées ni les archivées", () => {
    const tasks = [makeTask({ id: "fait", category: "UI", isDone: true }), makeTask({ id: "arch", category: "UI", archivedAt: 5 }), ...doTasks];
    expect(doWidgetData(tasks).count).toBe(5);
    const t = tree("DoFirstDo", tasks);
    expect(texts(t)).toEqual(["Faire", "  5", "Tâche 1", "Tâche 2", "Tâche 3"]);
    // Chaque ligne : rond à cocher (sans ouvrir l'app) et fiche de la tâche
    expect(clicks(t).filter((c) => c.action === COMPLETE_ACTION).map((c) => c.data)).toEqual(
      ["f1", "f2", "f3"].map((taskId) => ({ taskId, stepId: null }))
    );
    expect(uris(t)).toContain("todo4columns://task?id=f1");
  });

  it("« Faire » petit (redimensionné) : moins de lignes", () => {
    expect(texts(tree("DoFirstDo", doTasks, { width: 110, height: 90 }))).toEqual(["Faire", "  5", "Tâche 1"]);
  });

  it("« Aujourd'hui » vide : « Rien de prévu aujourd'hui »", () => {
    const t = tree("DoFirstToday", [makeTask({ id: "demain", dueAt: at(9, 0, 1) })], { width: 250, height: 110 });
    expect(texts(t)).toEqual(["Aujourd'hui · lundi 9 novembre", "Rien de prévu aujourd'hui"]);
    expect(uris(t)).toEqual(["todo4columns://calendar"]);
  });

  it("« Aujourd'hui » : échéances et étapes du jour, avec l'heure si elle est renseignée, triées", () => {
    const tasks = [
      makeTask({ id: "budget", title: "Budget", category: "INU", dueAt: at(14, 30) }),
      makeTask({
        id: "expo",
        title: "Exposé",
        category: "UI",
        steps: [
          { id: "s1", title: "Plan", done: false, doneAt: null, day: dayKey(NOW), time: "09:00" },
          { id: "s2", title: "Diapos", done: false, doneAt: null, day: dayKey(NOW), time: null },
          { id: "s3", title: "Faite", done: true, doneAt: 1, day: dayKey(NOW), time: "08:00" },
        ],
      }),
      makeTask({ id: "fini", title: "Terminée", dueAt: at(11), isDone: true, completedAt: 1 }),
      makeTask({ id: "arch", title: "Archivée", dueAt: at(12), archivedAt: 1 }),
      makeTask({ id: "demain", title: "Demain", dueAt: at(9, 0, 1) }),
      // Tâche récurrente dont l'échéance est demain : pas d'occurrence calculée aujourd'hui
      makeTask({ id: "rec", title: "Course", category: "INU", dueAt: at(7, 0, -1), isDone: true, completedAt: 1, recurrence: { freq: "daily", hour: 7, minute: 0 } }),
    ];
    const items = todayWidgetData(tasks, NOW);
    expect(items.map((i) => [i.title, i.time, i.stepId])).toEqual([
      ["Plan", "09:00", "s1"],
      ["Budget", "14:30", null],
      ["Diapos", null, "s2"],
    ]);
    const t = tree("DoFirstToday", tasks, { width: 250, height: 250 });
    expect(texts(t)).toEqual(["Aujourd'hui · lundi 9 novembre", "09:00  ", "Plan · Exposé", "14:30  ", "Budget", "Diapos · Exposé"]);
    expect(clicks(t).filter((c) => c.action === COMPLETE_ACTION).map((c) => c.data)).toEqual([
      { taskId: "expo", stepId: "s1" },
      { taskId: "budget", stepId: null },
      { taskId: "expo", stepId: "s2" },
    ]);
  });

  it("« Aujourd'hui » trop petit pour tout : « + N de plus »", () => {
    const tasks = [8, 9, 10, 11, 12].map((h) => makeTask({ id: `t${h}`, title: `À ${h} h`, dueAt: at(h) }));
    expect(texts(tree("DoFirstToday", tasks, { width: 250, height: 110 })).at(-1)).toBe("+ 3 de plus");
  });

  it("« Matrice » : 4 cases avec nombre et premières tâches ; 2 par case si le widget est bas", () => {
    const tasks = [
      ...["a", "b", "c", "d"].map((x) => makeTask({ id: `ui-${x}`, title: `Faire ${x}`, category: "UI" })),
      makeTask({ id: "inu", title: "Planifier a", category: "INU" }),
    ];
    const data = matrixWidgetData(tasks);
    expect(data.map((c) => [c.category, c.count])).toEqual([["UI", 4], ["INU", 1], ["UDI", 0], ["NDNI", 0]]);
    const tall = texts(tree("DoFirstMatrix", tasks, { width: 250, height: 320 }));
    expect(tall).toEqual(["Faire", "4", "Faire a", "Faire b", "Faire c", "Planifier", "1", "Planifier a", "Déléguer", "0", "Si j'ai le temps", "0"]);
    const low = texts(tree("DoFirstMatrix", tasks, { width: 250, height: 180 }));
    expect(low.filter((x) => x.startsWith("Faire "))).toEqual(["Faire a", "Faire b"]);
    const links = uris(tree("DoFirstMatrix", tasks));
    expect(links).toEqual(expect.arrayContaining(["todo4columns://", "todo4columns://quadrant/NDNI", "todo4columns://task?id=inu"]));
  });

  it("langue de l'app : anglais, japonais", () => {
    setLanguagePreference("en");
    expect(texts(tree("DoFirstDo", []))).toEqual(["Do", "  0", "Nothing to do right now"]);
    expect(texts(tree("DoFirstToday", [], { width: 250, height: 110 }))[1]).toBe("Nothing planned today");
    setLanguagePreference("ja");
    expect(texts(tree("DoFirstToday", [], { width: 250, height: 110 }))[1]).toBe("今日の予定はありません");
  });

  it("accessibilité : le rond annonce « Cocher … »", () => {
    const labels = walk(tree("DoFirstDo", doTasks)).map((n) => n.props?.accessibilityLabel).filter(Boolean);
    expect(labels).toContain("Cocher Tâche 1");
    expect(labels).toContain("Nouvelle tâche");
  });
});

describe("liens profonds", () => {
  it("chaque lien mène à un écran de l'app avec ses paramètres", () => {
    // Comme expo-router : hôte + chemin = route, paramètres de la requête
    const parse = (u: string) => {
      const url = new URL(u);
      expect(url.protocol).toBe("todo4columns:");
      return { route: [url.hostname, url.pathname.replace(/^\//, "")].filter(Boolean).join("/"), params: Object.fromEntries(url.searchParams) };
    };
    expect(parse("todo4columns://task?id=f1")).toEqual({ route: "task", params: { id: "f1" } });
    expect(parse("todo4columns://task?category=UI&voice=1")).toEqual({ route: "task", params: { category: "UI", voice: "1" } });
    expect(parse("todo4columns://quadrant/INU").route).toBe("quadrant/INU");
    // Écrans et paramètres lus
    const root = path.resolve(__dirname, "../..");
    const taskScreen = fs.readFileSync(path.join(root, "app/task.tsx"), "utf8");
    expect(taskScreen).toMatch(/useLocalSearchParams<\{ id\?: string; category\?: string; voice\?: string \}>/);
    expect(fs.existsSync(path.join(root, "app/quadrant/[category].tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "app/calendar.tsx"))).toBe(true);
    // Schéma déclaré
    expect(JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo.scheme).toBe("todo4columns");
  });
});

describe("coche depuis un widget, app fermée", () => {
  const stored = async () => parseStoredTasks(await AsyncStorage.getItem(STORAGE_KEY)).tasks;
  const store = async (tasks: Task[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true });
  };

  it("tâche terminée, journal, rappels annulés, modification notée pour la synchronisation", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    const id = await Notifications.scheduleNotificationAsync({ content: { title: "x", data: { taskId: "t" } }, trigger: null });
    await store([makeTask({ id: "t", category: "UI", nagInterval: 60, updatedAt: NOW - HOUR / 2, notificationIds: [id] })]);
    expect(await checkFromWidget({ taskId: "t", stepId: null })).toBe("saved");
    const [done] = await stored();
    expect(done).toMatchObject({ isDone: true, completedAt: NOW, modifiedAt: NOW, notificationIds: [] });
    expect(scheduledFor("t")).toEqual([]);
    expect(JSON.parse((await AsyncStorage.getItem(COMPLETION_LOG_KEY))!).entries).toEqual([{ date: NOW, category: "UI" }]);
  });

  it("tâche récurrente : occurrence suivante créée, avec son rappel", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    await store([makeTask({ id: "r", category: "INU", dueAt: at(9), reminderOffset: 60, recurrence: { freq: "daily", hour: 9, minute: 0 } })]);
    await checkFromWidget({ taskId: "r", stepId: null });
    const tasks = await stored();
    const next = tasks.find((t) => t.id === `r-next-${at(9)}`)!;
    expect(next).toMatchObject({ isDone: false, dueAt: at(9, 0, 1), modifiedAt: NOW });
    expect(scheduledFor(next.id).length).toBeGreaterThan(0);
    expect(next.notificationIds.length).toBeGreaterThan(0);
  });

  it("étape du jour : cochée, la tâche reste à faire, aucune entrée au journal", async () => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    await store([
      makeTask({ id: "e", steps: [{ id: "s1", title: "Plan", done: false, doneAt: null, day: dayKey(NOW), time: "09:00" }] }),
    ]);
    await checkFromWidget({ taskId: "e", stepId: "s1" });
    const [task] = await stored();
    expect(task.steps![0]).toMatchObject({ done: true, doneAt: NOW });
    expect(task).toMatchObject({ isDone: false, modifiedAt: NOW });
    expect(JSON.parse((await AsyncStorage.getItem(COMPLETION_LOG_KEY)) ?? '{"entries":[]}').entries).toEqual([]);
  });

  it("tâche déjà terminée ou absente : rien ne change", async () => {
    await store([makeTask({ id: "t", isDone: true, completedAt: 5 })]);
    expect(await checkFromWidget({ taskId: "t", stepId: null })).toBe("unchanged");
    expect(await checkFromWidget({ taskId: "absente", stepId: null })).toBe("unchanged");
    expect(getTombstones()).toEqual([]);
  });

  it("gestionnaire : coche, puis le widget et les autres sont redessinés sans la tâche", async () => {
    await store([makeTask({ id: "t", title: "À cocher", category: "UI" }), makeTask({ id: "u", title: "Reste", category: "UI" })]);
    const draw = jest.fn();
    await widgetTaskHandler({
      widgetInfo: { widgetName: "DoFirstDo", widgetId: 1, width: 110, height: 200, screenInfo: {} as never },
      widgetAction: "WIDGET_CLICK",
      clickAction: COMPLETE_ACTION,
      clickActionData: { taskId: "t", stepId: null },
      renderWidget: draw,
    });
    expect(texts(buildWidgetTree(draw.mock.calls[0][0]))).toEqual(["Faire", "  1", "Reste"]);
    expect(requestUpdate.mock.calls.map((c) => c[0].widgetName)).toEqual(["DoFirstToday", "DoFirstMatrix"]);
  });

  it("gestionnaire : ajout et redimensionnement dessinés depuis les données enregistrées, dans la langue de l'app", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t", title: "Enregistrée", category: "UI" })]));
    await saveSettings({ ...DEFAULT_SETTINGS, language: "en" });
    for (const widgetAction of ["WIDGET_ADDED", "WIDGET_RESIZED", "WIDGET_UPDATE"] as const) {
      const draw = jest.fn();
      await widgetTaskHandler({
        widgetInfo: { widgetName: "DoFirstDo", widgetId: 1, width: 110, height: 200, screenInfo: {} as never },
        widgetAction,
        renderWidget: draw,
      });
      expect(texts(buildWidgetTree(draw.mock.calls[0][0]))).toEqual(["Do", "  1", "Enregistrée"]);
    }
    const draw = jest.fn();
    await widgetTaskHandler({
      widgetInfo: { widgetName: "DoFirstDo", widgetId: 1, width: 110, height: 200, screenInfo: {} as never },
      widgetAction: "WIDGET_CLICK",
      clickAction: "OPEN_URI",
      clickActionData: { uri: "todo4columns://task?id=t" },
      renderWidget: draw,
    });
    expect(draw).not.toHaveBeenCalled();
  });
});

describe("app ouverte", () => {
  let actions: TaskActions;
  let state: TasksState;
  function Grab() {
    actions = useTaskActions();
    state = useTasksSelector((s) => s);
    return null;
  }
  const renderApp = async (tasks: Task[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
    const view = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Grab />
          <WidgetSync enabled />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await waitFor(() => expect(state.isLoaded).toBe(true));
    return view;
  };

  it("une coche depuis le widget passe par l'app : données, journal, rappels, modification notée", async () => {
    await renderApp([makeTask({ id: "t", category: "UI", nagInterval: 60, updatedAt: Date.now() })]);
    await waitFor(() => expect(scheduledFor("t").length).toBeGreaterThan(0));
    let result: string = "";
    await act(async () => {
      result = await checkFromWidget({ taskId: "t", stepId: null });
    });
    expect(result).toBe("live");
    expect(state.tasks[0].isDone).toBe(true);
    expect(state.tasks[0].modifiedAt).toBeGreaterThan(0);
    await waitFor(() => expect(scheduledFor("t")).toEqual([]));
    await waitFor(() => expect(state.completions).toHaveLength(1));
  });

  it("widgets redessinés après un changement de tâches, une synchronisation et un changement de langue", async () => {
    await renderApp([makeTask({ id: "t", category: "UI" })]);
    const names = () => requestUpdate.mock.calls.map((c) => c[0].widgetName);
    await waitFor(() => expect(names()).toEqual([...WIDGET_NAMES]), { timeout: 2000 });
    requestUpdate.mockClear();
    await act(async () => actions.addTask({ title: "Nouvelle", category: "UI" }));
    await act(async () => actions.addTask({ title: "Encore", category: "UI" }));
    // Regroupés : un seul rafraîchissement pour deux changements
    await waitFor(() => expect(names()).toEqual([...WIDGET_NAMES]), { timeout: 2000 });
    const rendered = requestUpdate.mock.calls[0][0].renderWidget({ width: 110, height: 200 });
    expect(texts(buildWidgetTree(rendered))).toEqual(["Faire", "  3", "Tâche", "Nouvelle", "Encore"].slice(0, 5));
    requestUpdate.mockClear();
    await act(async () => {
      await actions.applySynced({ ...EMPTY_SYNC_DATA, tasks: [makeTask({ id: "venue", title: "Venue d'ailleurs", category: "INU", modifiedAt: Date.now() })] });
    });
    await waitFor(() => expect(names()).toEqual([...WIDGET_NAMES]), { timeout: 2000 });
    requestUpdate.mockClear();
    await act(async () => actions.updateSettings({ ...actions.getSettings(), language: "en" }));
    await waitFor(() => expect(names()).toEqual([...WIDGET_NAMES]), { timeout: 2000 });
    const english = requestUpdate.mock.calls[0][0].renderWidget({ width: 110, height: 200 });
    expect(texts(buildWidgetTree(english))[0]).toBe("Do");
    void WIDGET_REFRESH_DELAY_MS;
  });

  it("minuit : « Aujourd'hui » redessiné", async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 9, 23, 59, 0) });
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([]));
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <Grab />
          <WidgetSync enabled />
        </TasksProvider>
      </SafeAreaProvider>
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(state.isLoaded).toBe(true);
    requestUpdate.mockClear();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60 * 1000);
    });
    expect(requestUpdate.mock.calls.map((c) => c[0].widgetName)).toEqual(["DoFirstToday"]);
    expect(nextMidnight(new Date(2026, 10, 9, 23, 59).getTime())).toBe(new Date(2026, 10, 10).getTime());
  });
});

describe("déclaration des widgets", () => {
  const root = path.resolve(__dirname, "../..");
  const appJson = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
  const config = appJson.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "react-native-android-widget")[1];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const strings = require("../widgets/pickerStrings.json");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const plugin = require("../../plugins/withWidgetStrings");

  it("trois widgets 2×2, 4×2, 4×4, redimensionnables, avec aperçu ; rafraîchissement périodique pour « Aujourd'hui » seulement", () => {
    expect(config.widgets.map((w: { name: string; targetCellWidth: number; targetCellHeight: number; resizeMode: string; updatePeriodMillis: number }) => [
      w.name,
      w.targetCellWidth,
      w.targetCellHeight,
      w.resizeMode,
      w.updatePeriodMillis,
    ])).toEqual([
      ["DoFirstDo", 2, 2, "horizontal|vertical", 0],
      ["DoFirstToday", 4, 2, "horizontal|vertical", 3600000],
      ["DoFirstMatrix", 4, 4, "horizontal|vertical", 0],
    ]);
    for (const w of config.widgets) expect(fs.existsSync(path.join(root, w.previewImage))).toBe(true);
    expect(config.widgets.map((w: { name: string }) => w.name)).toEqual([...WIDGET_NAMES]);
    expect(appJson.expo.plugins).toContain("./plugins/withWidgetStrings");
  });

  it("noms et descriptions du sélecteur dans les 13 langues, par des ressources traduisibles", () => {
    expect(Object.keys(strings).sort()).toEqual(["de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "pt-BR", "ru", "tr", "zh-Hans"]);
    for (const lang of Object.keys(strings)) {
      for (const key of ["do", "today", "matrix"]) {
        expect(strings[lang][key].label).toMatch(/^DoFirst · .+/);
        expect(strings[lang][key].description.length).toBeGreaterThan(5);
      }
    }
    // Le plugin du widget marque sa description non traduisible : elle ne fait que renvoyer à la nôtre
    expect(config.widgets.map((w: { description: string }) => w.description)).toEqual(
      ["dofirstdo", "dofirsttoday", "dofirstmatrix"].map((n) => `@string/widget_${n}_desc`)
    );
    expect(config.widgets[0].label).toBe("@string/widget_dofirstdo_label");
  });

  it("ressources Android : apostrophes échappées, libellé et description dans chaque langue", () => {
    const fr = plugin.widgetStringsXml("fr");
    expect(fr).toContain('<string name="widget_dofirsttoday_label">DoFirst · Aujourd\\\'hui</string>');
    expect(fr).toContain('<string name="widget_dofirstdo_desc">');
    expect(plugin.widgetStringsXml("en")).toContain('<string name="widget_dofirstmatrix_desc">The 4 quadrants and their tasks</string>');
    expect(plugin.FOLDERS["pt-BR"]).toBe("values-pt-rBR");
  });

  it("service de premier plan de WorkManager (dépendance du widget) bloqué : jamais utilisé", () => {
    expect(appJson.expo.android.blockedPermissions).toContain("android.permission.FOREGROUND_SERVICE");
  });

  it("point d'entrée : gestionnaire des widgets enregistré sur Android", () => {
    const entry = fs.readFileSync(path.join(root, "index.js"), "utf8");
    expect(entry).toContain('import "expo-router/entry"');
    expect(entry).toContain("registerWidgetTaskHandler(widgetTaskHandler)");
    expect(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).main).toBe("index.js");
  });
});
