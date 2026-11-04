import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useTasks } from "../hooks/useTasks";
import { DEFAULT_SETTINGS } from "../settings";
import { STORAGE_KEY } from "../storage";

// Contenu enregistré sous TASKS_4COLS
const stored = async () => {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json === null ? null : JSON.parse(json);
};

// Monte le hook et attend la fin du chargement initial
const setup = async () => {
  const hook = await renderHook(() => useTasks());
  await waitFor(async () => expect(await stored()).not.toBeNull());
  return hook;
};

describe("useTasks", () => {
  beforeEach(() => AsyncStorage.clear());

  it("ajoute une tâche avec les rappels par défaut du quadrant", async () => {
    const { result } = await setup();

    await act(() => result.current.addTask({ title: "Rendre le dossier", category: "UI" }));

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]).toMatchObject({
      title: "Rendre le dossier",
      category: "UI",
      isDone: false,
      timerEnd: null,
      dueAt: null,
      reminderOffset: null,
      nagInterval: DEFAULT_SETTINGS.doNagInterval,
      nagRepeat: false,
      delegatedTo: null,
    });
    expect(result.current.tasks[0].createdAt).toBe(result.current.tasks[0].updatedAt);
  });

  it("enregistre les réglages de rappel choisis, sans ceux des autres quadrants", async () => {
    const { result } = await setup();

    await act(() =>
      result.current.addTask({
        title: "Relancer le devis",
        category: "UDI",
        delegatedTo: "  Marie ",
        nagInterval: 4320,
        dueAt: 123, // échéance facultative, gardée pour le message envoyé à la personne
        reminderOffset: 60, // pas de rappel « Planifier » pour Déléguer
      })
    );

    expect(result.current.tasks[0]).toMatchObject({
      delegatedTo: "Marie",
      nagInterval: 4320,
      dueAt: 123,
      reminderOffset: null,
    });
  });

  it("coche puis décoche une tâche", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Tâche", category: "UI" }));
    const id = result.current.tasks[0].id;

    const before = Date.now();
    await act(() => result.current.toggleDone(id));
    expect(result.current.tasks[0].isDone).toBe(true);
    // Date de fin, pour le bilan de la semaine
    expect(result.current.tasks[0].completedAt).toBeGreaterThanOrEqual(before);

    await act(() => result.current.toggleDone(id));
    expect(result.current.tasks[0].isDone).toBe(false);
    expect(result.current.tasks[0].completedAt).toBeNull();
  });

  it("« Fait » depuis une notification enregistre la date de fin", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Tâche", category: "UDI" }));
    const id = result.current.tasks[0].id;

    await act(() => result.current.completeTask(id));
    expect(result.current.tasks[0]).toMatchObject({ isDone: true, completedAt: expect.any(Number) });
  });

  it("modifie le titre, le quadrant et les rappels d'une tâche", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Brouillon", category: "UI" }));
    const id = result.current.tasks[0].id;

    await act(() =>
      result.current.updateTask(id, {
        title: "Préparer la réunion",
        category: "INU",
        dueAt: 1_900_000_000_000,
        reminderOffset: 60,
      })
    );

    expect(result.current.tasks[0]).toMatchObject({
      id,
      title: "Préparer la réunion",
      category: "INU",
      dueAt: 1_900_000_000_000,
      reminderOffset: 60,
      nagInterval: null, // réglage de Faire retiré
    });
  });

  it("déplace une tâche vers un autre quadrant avec ses rappels par défaut", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "À confier", category: "UI" }));
    const id = result.current.tasks[0].id;

    await act(() => result.current.moveTask(id, "UDI"));
    expect(result.current.tasks[0]).toMatchObject({
      category: "UDI",
      nagInterval: 1440, // « Demain »
      nagRepeat: false,
    });

    await act(() => result.current.moveTask(id, "NDNI"));
    expect(result.current.tasks[0]).toMatchObject({
      category: "NDNI",
      nagInterval: null,
      reminderOffset: null,
    });
  });

  it("supprime une tâche puis l'annule à sa place d'origine", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Première", category: "UI" }));
    await act(() => result.current.addTask({ title: "Deuxième", category: "UI" }));
    await act(() => result.current.addTask({ title: "Troisième", category: "UI" }));
    const middle = result.current.tasks[1];

    let removed: ReturnType<typeof result.current.removeTask> = [];
    await act(() => {
      removed = result.current.removeTask(middle.id);
    });
    expect(result.current.tasks.map((t) => t.title)).toEqual(["Première", "Troisième"]);
    expect(removed).toEqual([{ task: middle, index: 1 }]);

    await act(() => result.current.restoreTasks(removed));
    expect(result.current.tasks.map((t) => t.title)).toEqual([
      "Première",
      "Deuxième",
      "Troisième",
    ]);
  });

  it("vide les terminées d'un seul quadrant, avec annulation possible", async () => {
    const { result } = await setup();
    await act(() => result.current.addTask({ title: "Faite UI", category: "UI" }));
    await act(() => result.current.addTask({ title: "En cours UI", category: "UI" }));
    await act(() => result.current.addTask({ title: "Faite INU", category: "INU" }));
    const [doneUI, , doneINU] = result.current.tasks;
    await act(() => result.current.toggleDone(doneUI.id));
    await act(() => result.current.toggleDone(doneINU.id));

    let removed: ReturnType<typeof result.current.clearDone> = [];
    await act(() => {
      removed = result.current.clearDone("UI");
    });
    expect(result.current.tasks.map((t) => t.title)).toEqual(["En cours UI", "Faite INU"]);
    expect(removed).toHaveLength(1);

    await act(() => result.current.restoreTasks(removed));
    expect(result.current.tasks.map((t) => t.title)).toEqual([
      "Faite UI",
      "En cours UI",
      "Faite INU",
    ]);
  });

  it("enregistre les tâches au format courant (v7) et les retrouve au redémarrage", async () => {
    const first = await setup();
    await act(() => first.result.current.addTask({ title: "Persistante", category: "UDI" }));

    await waitFor(async () => {
      const data = await stored();
      expect(data.schemaVersion).toBe(7);
      expect(data.tasks).toHaveLength(1);
    });
    await first.unmount();

    const second = await renderHook(() => useTasks());
    await waitFor(() =>
      expect(second.result.current.tasks.map((t) => t.title)).toEqual(["Persistante"])
    );
  });

  it("charge et migre les tâches de l'ancien format", async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "1717000000000", title: "Ancienne", category: "NDNI", isDone: true, timerEnd: null },
      ])
    );

    const { result } = await renderHook(() => useTasks());

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0]).toMatchObject({
      title: "Ancienne",
      category: "NDNI",
      isDone: true,
      createdAt: 1717000000000,
      delegatedTo: null,
    });
    await waitFor(async () => expect((await stored()).schemaVersion).toBe(7));
  });

  it("ne sauvegarde rien si la lecture échoue", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "[]");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("disque"));
    (AsyncStorage.setItem as jest.Mock).mockClear();

    const { result } = await renderHook(() => useTasks());
    await act(() => result.current.addTask({ title: "Non sauvegardée", category: "UI" }));

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe("[]");
  });
});
