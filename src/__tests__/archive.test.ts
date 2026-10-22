import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ARCHIVE_AFTER_MS, archiveStaleTasks, shouldArchive } from "../archive";
import { useTasks } from "../hooks/useTasks";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

describe("archivage des tâches « Si j'ai le temps »", () => {
  it("archive une tâche « Si j'ai le temps » non terminée après 7 jours dans le quadrant", () => {
    const old = makeTask({ category: "NDNI", categoryChangedAt: NOW - ARCHIVE_AFTER_MS });
    const recent = makeTask({ category: "NDNI", categoryChangedAt: NOW - 6 * DAY });

    expect(shouldArchive(old, NOW)).toBe(true);
    expect(shouldArchive(recent, NOW)).toBe(false);
  });

  it("n'archive ni les autres quadrants, ni les tâches terminées, ni deux fois", () => {
    const longAgo = NOW - 30 * DAY;
    expect(shouldArchive(makeTask({ category: "UI", categoryChangedAt: longAgo }), NOW)).toBe(false);
    expect(
      shouldArchive(makeTask({ category: "NDNI", isDone: true, categoryChangedAt: longAgo }), NOW)
    ).toBe(false);
    expect(
      shouldArchive(makeTask({ category: "NDNI", archivedAt: 5, categoryChangedAt: longAgo }), NOW)
    ).toBe(false);
  });

  it("ne recrée pas la liste quand rien n'est à archiver", () => {
    const tasks = [makeTask({ category: "NDNI", categoryChangedAt: NOW })];
    expect(archiveStaleTasks(tasks, NOW)).toBe(tasks);
  });

  describe("dans useTasks", () => {
    beforeEach(() => AsyncStorage.clear());

    const ARCHIVE_ON: Settings = { ...DEFAULT_SETTINGS, autoArchive: true };

    // a : 8 jours dans le quadrant, b : 1 jour, c : déjà archivée
    const storeTasks = async () => {
      const now = Date.now();
      await AsyncStorage.setItem(
        STORAGE_KEY,
        serializeTasks([
          makeTask({ id: "a", category: "NDNI", categoryChangedAt: now - 8 * DAY }),
          makeTask({ id: "b", category: "NDNI", categoryChangedAt: now - DAY }),
          makeTask({ id: "c", category: "NDNI", categoryChangedAt: now - 20 * DAY, archivedAt: 5 }),
        ])
      );
    };
    const archivedAt = (tasks: { id: string; archivedAt: number | null }[]) =>
      Object.fromEntries(tasks.map((t) => [t.id, t.archivedAt]));

    it("n'archive rien par défaut et laisse archivées les tâches qui l'étaient", async () => {
      await storeTasks();
      const { result } = await renderHook(() => useTasks());
      await waitFor(() => expect(result.current.isLoaded).toBe(true));

      expect(archivedAt(result.current.tasks)).toEqual({ a: null, b: null, c: 5 });
      await waitFor(async () =>
        expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!).tasks[2].archivedAt).toBe(5)
      );
    });

    it("archive dès que l'option est activée", async () => {
      await storeTasks();
      const { result, rerender } = await renderHook(
        (settings: Settings) => useTasks(settings),
        { initialProps: DEFAULT_SETTINGS }
      );
      await waitFor(() => expect(result.current.isLoaded).toBe(true));
      expect(result.current.tasks[0].archivedAt).toBeNull();

      await rerender(ARCHIVE_ON);
      await waitFor(() => expect(result.current.tasks[0].archivedAt).not.toBeNull());
      expect(result.current.tasks[1].archivedAt).toBeNull();
      expect(result.current.tasks[2].archivedAt).toBe(5);
    });

    it("option activée : archive au démarrage puis permet de restaurer", async () => {
      await storeTasks();

      const { result } = await renderHook(() => useTasks(ARCHIVE_ON));
      await waitFor(() => expect(result.current.tasks[0].archivedAt).not.toBeNull());

      expect(result.current.tasks[1].archivedAt).toBeNull();

      await act(() => result.current.unarchiveTask("a"));
      const restored = result.current.tasks[0];
      expect(restored.archivedAt).toBeNull();
      // Le délai de 7 jours repart de zéro
      expect(shouldArchive(restored, Date.now() + 6 * DAY)).toBe(false);
    });

    it("note la date d'arrivée dans un nouveau quadrant", async () => {
      const { result } = await renderHook(() => useTasks());
      await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull());
      await act(() => result.current.addTask({ title: "x", category: "UI" }));
      const before = result.current.tasks[0];

      await act(() => result.current.updateTask(before.id, { title: "y" }));
      expect(result.current.tasks[0].categoryChangedAt).toBe(before.categoryChangedAt);

      await act(() => result.current.moveTask(before.id, "NDNI"));
      expect(result.current.tasks[0].categoryChangedAt).toBeGreaterThanOrEqual(
        before.categoryChangedAt
      );
      expect(result.current.tasks[0].category).toBe("NDNI");
    });
  });
});
