import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import {
  categoryFromLabel,
  recoverFromEntries,
  RECOVERY_DONE_KEY,
  RECOVERY_LOG_KEY,
} from "../recovery";
import { loadTasks, STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

const NOW = new Date(2026, 9, 22, 10).getTime();
const json = (v: unknown) => JSON.stringify(v);
const recover = (entries: Record<string, unknown>) =>
  recoverFromEntries(
    Object.entries(entries).map(([k, v]) => [k, typeof v === "string" ? v : json(v)]),
    NOW
  );
const summary = (entries: Record<string, unknown>) =>
  recover(entries).tasks.map((t) => [t.title, t.category, t.isDone]);

describe("categoryFromLabel", () => {
  it.each([
    ["UI", "UI"],
    ["ndni", "NDNI"],
    ["urgentImportant", "UI"],
    ["notUrgentImportant", "INU"],
    ["urgent_not_important", "UDI"],
    ["Ni urgent ni important", "NDNI"],
    ["Important, pas urgent", "INU"],
    ["U-NI", "UDI"],
    ["NU-I", "INU"],
    ["q3", "UDI"],
    ["quadrant_4", "NDNI"],
    ["2", "INU"],
    ["Déléguer", "UDI"],
    ["do", "UI"],
  ])("« %s » → %s", (label, expected) => {
    expect(categoryFromLabel(label)).toBe(expected);
  });

  it.each(["tasks", "todo", "taches_a_faire", "urgent", "@app:state"])(
    "« %s » n'est pas une catégorie",
    (label) => {
      expect(categoryFromLabel(label)).toBeNull();
    }
  );
});

describe("recoverFromEntries", () => {
  it("convertit un tableau simple avec quadrant numéroté, done et id-timestamp", () => {
    const { tasks, log } = recover({
      tasks: [
        { id: 1729000000000, text: "Payer la facture", completed: true, quadrant: 1 },
        { id: 1729000000001, text: "Lire un livre", completed: false, quadrant: 2 },
        { id: "abc", text: "Sans quadrant" },
      ],
    });

    expect(tasks.map((t) => [t.title, t.category, t.isDone, t.createdAt])).toEqual([
      ["Payer la facture", "UI", true, 1729000000000],
      ["Lire un livre", "INU", false, 1729000000001],
      ["Sans quadrant", "INU", false, NOW], // Planifier par défaut, maintenant faute de date
    ]);
    expect(log.imported).toEqual([{ key: "tasks", count: 3 }]);
  });

  it("convertit un objet par quadrant (catégorie depuis le nom de la propriété)", () => {
    expect(
      summary({
        "@matrix": {
          urgentImportant: [{ title: "A", done: true }],
          notUrgentImportant: [{ title: "B" }],
          urgentNotImportant: [{ title: "C" }],
          notUrgentNotImportant: [{ title: "D" }],
        },
      })
    ).toEqual([
      ["A", "UI", true],
      ["B", "INU", false],
      ["C", "UDI", false],
      ["D", "NDNI", false],
    ]);
  });

  it("convertit des tableaux séparés par clé AsyncStorage", () => {
    expect(
      summary({
        tasks_q1: [{ name: "Un" }],
        tasks_q2: [{ name: "Deux" }],
        delegate: [{ label: "Trois", checked: true }],
        eliminer: [{ content: "Quatre" }],
      })
    ).toEqual([
      ["Un", "UI", false],
      ["Deux", "INU", false],
      ["Trois", "UDI", true],
      ["Quatre", "NDNI", false],
    ]);
  });

  it("lit les booléens urgent / important et les libellés de catégorie", () => {
    expect(
      summary({
        items: [
          { task: "Booléens", urgent: true, important: false },
          { title: "Libellé", category: "Important mais pas urgent" },
          { title: "Clé courte", category: "NDNI", isDone: true },
        ],
      })
    ).toEqual([
      ["Booléens", "UDI", false],
      ["Libellé", "INU", false],
      ["Clé courte", "NDNI", true],
    ]);
  });

  it("trouve les tâches dans un état imbriqué (JSON dans une chaîne, type redux-persist)", () => {
    const persisted = {
      tasks: json({ list: [{ title: "Imbriquée", createdAt: "2025-10-20T09:00:00.000Z" }] }),
      _persist: json({ version: -1, rehydrated: true }),
    };
    const { tasks } = recover({ "persist:root": persisted });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].createdAt).toBe(Date.parse("2025-10-20T09:00:00.000Z"));
  });

  it("convertit un timestamp en secondes", () => {
    const { tasks } = recover({ todos: [{ title: "x", date: 1729000000 }] });
    expect(tasks[0].createdAt).toBe(1729000000 * 1000);
  });

  it("crée des tâches complètes, sans rappel, et non archivables tout de suite", () => {
    const [task] = recover({ todos: [{ title: "x", quadrant: 4 }] }).tasks;
    expect(task).toMatchObject({
      category: "NDNI",
      timerEnd: null,
      nagInterval: null,
      dueAt: null,
      archivedAt: null,
      categoryChangedAt: NOW,
      notificationIds: [],
    });
    expect(task.id).toMatch(/^rec-/);
  });

  it("ne garde qu'une fois une tâche présente sous plusieurs clés", () => {
    const list = [{ title: "Doublon", quadrant: 1 }];
    expect(recover({ tasks: list, tasks_backup: list }).tasks).toHaveLength(1);
  });

  it("ignore les données illisibles ou sans tâches, et les clés de l'app", () => {
    const { tasks, log } = recover({
      broken: "{pas du json",
      count: "42",
      prefs: { theme: "dark", tags: ["a", "b"] },
      notes: [{ id: 1, color: "red" }], // pas de champ texte
      TASKS_4COLS_BACKUP_V1: [{ title: "Ne pas relire" }],
      SETTINGS: { settings: {} },
    });

    expect(tasks).toEqual([]);
    expect(log.scannedKeys).toEqual(["broken", "count", "prefs", "notes"]);
    expect(log.skipped).toEqual([
      { key: "broken", reason: "JSON illisible" },
      { key: "count", reason: "aucune tâche reconnue" },
      { key: "prefs", reason: "aucune tâche reconnue" },
      { key: "notes", reason: "aucune tâche reconnue" },
    ]);
  });
});

describe("récupération au chargement", () => {
  beforeEach(() => AsyncStorage.clear());
  beforeEach(() => jest.spyOn(console, "log").mockImplementation(() => {}));

  const legacy = json([{ id: 1729000000000, text: "Ancienne tâche", completed: false, quadrant: 1 }]);

  it("importe les anciennes tâches, les enregistre et laisse les clés d'origine intactes", async () => {
    await AsyncStorage.setItem("@prioritize_tasks", legacy);

    const tasks = await loadTasks();

    expect(tasks.map((t) => [t.title, t.category])).toEqual([["Ancienne tâche", "UI"]]);
    expect(await AsyncStorage.getItem("@prioritize_tasks")).toBe(legacy);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!).tasks).toHaveLength(1);
    expect(await AsyncStorage.getItem(RECOVERY_DONE_KEY)).not.toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(RECOVERY_LOG_KEY))!).imported).toEqual([
      { key: "@prioritize_tasks", count: 1 },
    ]);
  });

  it("ne s'exécute qu'une fois", async () => {
    await AsyncStorage.setItem("@prioritize_tasks", legacy);
    await loadTasks();
    await AsyncStorage.removeItem(STORAGE_KEY); // même si TASKS_4COLS disparaît

    expect(await loadTasks()).toEqual([]);
    expect(await AsyncStorage.getItem("@prioritize_tasks")).toBe(legacy);
  });

  it("ne s'exécute pas quand TASKS_4COLS existe déjà", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ title: "Actuelle" })]));
    await AsyncStorage.setItem("@prioritize_tasks", legacy);

    expect((await loadTasks()).map((t) => t.title)).toEqual(["Actuelle"]);
    expect(await AsyncStorage.getItem(RECOVERY_DONE_KEY)).toBeNull();
  });

  it("sans aucune donnée : liste vide, drapeau posé", async () => {
    expect(await loadTasks()).toEqual([]);
    expect(await AsyncStorage.getItem(RECOVERY_DONE_KEY)).not.toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(RECOVERY_LOG_KEY))!).scannedKeys).toEqual([]);
  });

  it("affiche les tâches récupérées dans l'app", async () => {
    await AsyncStorage.setItem("tasks", legacy);
    const { result } = await renderHook(() => useTasks());
    await waitFor(() =>
      expect(result.current.tasks.map((t) => t.title)).toEqual(["Ancienne tâche"])
    );
  });
});
