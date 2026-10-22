import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseStoredTasks, serializeTasks } from "../migrations";
import {
  BACKUP_V1_KEY,
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
      dueAt: null,
      reminderOffset: null,
      nagInterval: null,
      nagRepeat: false,
      notificationIds: [],
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

  it("relit à l'identique le format v2", () => {
    const { tasks } = parseStoredTasks(JSON.stringify(v1Tasks), NOW);
    const json = serializeTasks(tasks);

    expect(JSON.parse(json).schemaVersion).toBe(2);
    expect(parseStoredTasks(json, NOW)).toEqual({ tasks, fromVersion: 2 });
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
