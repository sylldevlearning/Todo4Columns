import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseStoredTasks, serializeTasks } from "../migrations";
import {
  BACKUP_V1_KEY,
  backupKeyFor,
  CORRUPT_BACKUP_PREFIX,
  loadTasks,
  STORAGE_KEY,
} from "../storage";

const NOW = 1_800_000_000_000;

// Format des versions 1.0.x : tableau brut
const v1Tasks = [
  { id: "1717000000000", title: "Faire", category: "UI", isDone: false, timerEnd: null },
  { id: "1717000000001", title: "Planifier", category: "INU", isDone: true, timerEnd: null },
  { id: "1717000000002", title: "Déléguer", category: "UDI", isDone: false, timerEnd: 1717000999999 },
  { id: "1717000000003", title: "Éliminer", category: "NDNI", isDone: false, timerEnd: null },
];

describe("parseStoredTasks", () => {
  it("renvoie une liste vide si rien n'est enregistré", () => {
    expect(parseStoredTasks(null, NOW)).toEqual({ tasks: [], fromVersion: null });
  });

  it("migre l'ancien tableau brut sans perdre de tâche", () => {
    const { tasks, fromVersion } = parseStoredTasks(JSON.stringify(v1Tasks), NOW);

    expect(fromVersion).toBe(1);
    expect(tasks).toHaveLength(4);
    expect(tasks[2]).toEqual({
      id: "1717000000002",
      title: "Déléguer",
      category: "UDI",
      isDone: false,
      timerEnd: 1717000999999,
      createdAt: 1717000000002,
      updatedAt: 1717000000002,
      categoryChangedAt: NOW, // inconnu : date de la migration
      archivedAt: null,
      snoozedUntil: null,
      dueAt: null,
      reminderOffset: null,
      nagInterval: null,
      nagRepeat: false,
      delegatedTo: null,
      notificationIds: [],
      completedAt: null,
      priorityWeek: null,
      recurrence: null,
      nextOccurrenceId: null,
    });
  });

  it("migre le format v2 en ajoutant delegatedTo", () => {
    const v2 = {
      schemaVersion: 2,
      tasks: [{ ...v1Tasks[2], createdAt: 5, updatedAt: 6, nagInterval: 1440 }],
    };
    const { tasks, fromVersion } = parseStoredTasks(JSON.stringify(v2), NOW);

    expect(fromVersion).toBe(2);
    expect(tasks[0]).toMatchObject({
      createdAt: 5,
      updatedAt: 6,
      nagInterval: 1440,
      delegatedTo: null,
    });
  });

  it("conserve exactement les clés de catégories", () => {
    const { tasks } = parseStoredTasks(JSON.stringify(v1Tasks), NOW);
    expect(tasks.map((t) => t.category)).toEqual(["UI", "INU", "UDI", "NDNI"]);
    expect(tasks[1].isDone).toBe(true);
  });

  it("répare les tâches incomplètes au lieu de les supprimer", () => {
    const { tasks } = parseStoredTasks(
      JSON.stringify([{ id: "abc", title: "Sans catégorie" }, { title: 42 }]),
      NOW
    );

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      id: "abc",
      category: "UI",
      isDone: false,
      timerEnd: null,
      createdAt: NOW, // id non numérique
    });
    expect(tasks[1]).toMatchObject({ id: `${NOW}-1`, title: "42" });
  });

  it("migre le format v3 en conservant l'archivage et les reports déjà enregistrés", () => {
    const v3 = {
      schemaVersion: 3,
      tasks: [
        { ...v1Tasks[3], createdAt: 5, updatedAt: 6 },
        { ...v1Tasks[0], categoryChangedAt: 7, archivedAt: 8, snoozedUntil: 9 },
      ],
    };
    const { tasks, fromVersion } = parseStoredTasks(JSON.stringify(v3), NOW);

    expect(fromVersion).toBe(3);
    expect(tasks[0]).toMatchObject({ categoryChangedAt: NOW, archivedAt: null, snoozedUntil: null });
    expect(tasks[1]).toMatchObject({ categoryChangedAt: 7, archivedAt: 8, snoozedUntil: 9 });
  });

  it("rend uniques les identifiants en double, sans perdre de tâche", () => {
    const { tasks } = parseStoredTasks(
      JSON.stringify([v1Tasks[0], { ...v1Tasks[1], id: v1Tasks[0].id }]),
      NOW
    );

    expect(tasks.map((t) => t.title)).toEqual(["Faire", "Planifier"]);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(2);
    expect(tasks[0].id).toBe("1717000000000");
  });

  it("migre le format v4 : date de fin reprise de updatedAt pour les tâches terminées", () => {
    const v4 = {
      schemaVersion: 4,
      tasks: [
        { ...v1Tasks[1], createdAt: 5, updatedAt: 60, isDone: true },
        { ...v1Tasks[0], createdAt: 5, updatedAt: 70, isDone: false },
      ],
    };
    const { tasks, fromVersion } = parseStoredTasks(JSON.stringify(v4), NOW);

    expect(fromVersion).toBe(4);
    expect(tasks[0]).toMatchObject({ isDone: true, updatedAt: 60, completedAt: 60, priorityWeek: null });
    expect(tasks[1]).toMatchObject({ isDone: false, completedAt: null, priorityWeek: null });
  });

  it("v5 : sans date de fin enregistrée, aucune n'est inventée (tâches importées)", () => {
    const v5 = { schemaVersion: 5, tasks: [{ ...v1Tasks[1], updatedAt: 60, isDone: true }] };
    expect(parseStoredTasks(JSON.stringify(v5), NOW).tasks[0].completedAt).toBeNull();
  });

  it("migre le format v5 : aucune répétition", () => {
    const v5 = { schemaVersion: 5, tasks: [{ ...v1Tasks[1], updatedAt: 60, completedAt: 50, priorityWeek: 7 }] };
    const { tasks, fromVersion } = parseStoredTasks(JSON.stringify(v5), NOW);
    expect(fromVersion).toBe(5);
    expect(tasks[0]).toMatchObject({ completedAt: 50, priorityWeek: 7, recurrence: null, nextOccurrenceId: null });
  });

  it("v6 : une règle de répétition invalide est ignorée, une règle valide est nettoyée", () => {
    const v6 = {
      schemaVersion: 6,
      tasks: [
        { ...v1Tasks[1], dueAt: 5, recurrence: { freq: "toutes les heures" } },
        { ...v1Tasks[1], dueAt: 5, recurrence: { freq: "weekly", days: [4, 1, 9, 1, "x"] } },
        { ...v1Tasks[1], dueAt: 5, recurrence: { freq: "monthly", monthDay: 31 } },
      ],
    };
    const { tasks } = parseStoredTasks(JSON.stringify(v6), NOW);
    expect(tasks.map((t) => t.recurrence)).toEqual([
      null,
      { freq: "weekly", days: [1, 4] },
      { freq: "monthly", monthDay: 31 },
    ]);
  });

  it("relit à l'identique le format courant (v6)", () => {
    const { tasks } = parseStoredTasks(JSON.stringify(v1Tasks), NOW);
    tasks[0].delegatedTo = "Marie";
    tasks[1].completedAt = 1234;
    tasks[0].priorityWeek = 5678;
    tasks[1].dueAt = 99;
    tasks[1].recurrence = { freq: "yearly", month: 1, monthDay: 29 };
    tasks[1].nextOccurrenceId = "suivante";
    const json = serializeTasks(tasks);

    expect(JSON.parse(json).schemaVersion).toBe(6);
    expect(parseStoredTasks(json, NOW)).toEqual({ tasks, fromVersion: 6 });
  });

  it("lève une erreur sur un contenu illisible", () => {
    expect(() => parseStoredTasks("{pas du json", NOW)).toThrow();
    expect(() => parseStoredTasks(JSON.stringify({ foo: 1 }), NOW)).toThrow();
  });
});

describe("loadTasks", () => {
  beforeEach(() => AsyncStorage.clear());

  it("garde une copie du format d'origine avant la migration", async () => {
    const original = JSON.stringify(v1Tasks);
    await AsyncStorage.setItem(STORAGE_KEY, original);

    const tasks = await loadTasks();

    expect(tasks).toHaveLength(4);
    expect(await AsyncStorage.getItem(BACKUP_V1_KEY)).toBe(original);
  });

  it("garde aussi une copie du format v2 avant de passer en v4", async () => {
    const original = JSON.stringify({ schemaVersion: 2, tasks: v1Tasks });
    await AsyncStorage.setItem(STORAGE_KEY, original);

    expect(await loadTasks()).toHaveLength(4);
    expect(await AsyncStorage.getItem(backupKeyFor(2))).toBe(original);
  });

  it("garde une copie du format v5 (TASKS_4COLS_BACKUP_V5) avant de passer en v6", async () => {
    const original = JSON.stringify({ schemaVersion: 5, tasks: v1Tasks });
    await AsyncStorage.setItem(STORAGE_KEY, original);

    expect(await loadTasks()).toHaveLength(4);
    expect(await AsyncStorage.getItem("TASKS_4COLS_BACKUP_V5")).toBe(original);
  });

  it("garde une copie du format v4 (TASKS_4COLS_BACKUP_V4) avant de passer en v6", async () => {
    const original = JSON.stringify({
      schemaVersion: 4,
      tasks: v1Tasks.map((t) => ({ ...t, updatedAt: 42 })),
    });
    await AsyncStorage.setItem(STORAGE_KEY, original);

    const tasks = await loadTasks();
    expect(tasks).toHaveLength(4);
    expect(tasks[1]).toMatchObject({ isDone: true, completedAt: 42 });
    expect(await AsyncStorage.getItem("TASKS_4COLS_BACKUP_V4")).toBe(original);
  });

  it("ne remplace jamais une copie V4 déjà faite", async () => {
    await AsyncStorage.setItem("TASKS_4COLS_BACKUP_V4", "première copie");
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 4, tasks: v1Tasks }));

    await loadTasks();
    expect(await AsyncStorage.getItem("TASKS_4COLS_BACKUP_V4")).toBe("première copie");
  });

  it("garde une copie du format v3 avant de passer en v4", async () => {
    const original = JSON.stringify({ schemaVersion: 3, tasks: v1Tasks });
    await AsyncStorage.setItem(STORAGE_KEY, original);

    expect(await loadTasks()).toHaveLength(4);
    expect(await AsyncStorage.getItem(backupKeyFor(3))).toBe(original);
  });

  it("met de côté un contenu illisible au lieu de le perdre", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "{corrompu");
    jest.spyOn(console, "warn").mockImplementation(() => {});

    expect(await loadTasks()).toEqual([]);

    const keys = await AsyncStorage.getAllKeys();
    const backupKey = keys.find((k) => k.startsWith(CORRUPT_BACKUP_PREFIX));
    expect(backupKey).toBeDefined();
    expect(await AsyncStorage.getItem(backupKey!)).toBe("{corrompu");
  });
});
