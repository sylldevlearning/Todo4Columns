import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import TaskChips from "../components/TaskChips";
import TaskForm from "../components/TaskForm";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { isSoonUrgent } from "../notifications/status";
import { nextOccurrence, proposedDue, recurrenceLabel, withAnchors } from "../recurrence";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";
import { Recurrence, Task } from "../types";

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const next = (rule: Recurrence, dueAt: number, now: number) => nextOccurrence(withAnchors(rule, dueAt), dueAt, now);

describe("échéance suivante", () => {
  it("chaque jour : le prochain 9 h après maintenant", () => {
    expect(next({ freq: "daily" }, at(2026, 10, 20), at(2026, 10, 22, 10))).toBe(at(2026, 10, 23));
    expect(next({ freq: "daily" }, at(2026, 10, 20), at(2026, 10, 22, 8))).toBe(at(2026, 10, 22));
  });

  it("jours de semaine : le vendredi mène au lundi", () => {
    expect(next({ freq: "weekdays" }, at(2026, 10, 23), at(2026, 10, 23, 10))).toBe(at(2026, 10, 26));
    expect(next({ freq: "weekdays" }, at(2026, 10, 20), at(2026, 10, 20, 10))).toBe(at(2026, 10, 21));
  });

  it("chaque semaine, jours choisis (lundi et jeudi)", () => {
    const rule: Recurrence = { freq: "weekly", days: [1, 4] };
    expect(next(rule, at(2026, 10, 19), at(2026, 10, 19, 12))).toBe(at(2026, 10, 22));
    expect(next(rule, at(2026, 10, 22), at(2026, 10, 22, 12))).toBe(at(2026, 10, 26));
  });

  it("chaque semaine sans jour choisi : le jour de l'échéance", () => {
    expect(withAnchors({ freq: "weekly" }, at(2026, 10, 21)).days).toEqual([3]); // mercredi
    expect(next({ freq: "weekly" }, at(2026, 10, 21), at(2026, 10, 21, 10))).toBe(at(2026, 10, 28));
  });

  it("chaque mois", () => {
    expect(next({ freq: "monthly" }, at(2026, 10, 15), at(2026, 10, 15, 10))).toBe(at(2026, 11, 15));
  });

  it("chaque année", () => {
    expect(next({ freq: "yearly" }, at(2026, 10, 15), at(2026, 10, 15, 10))).toBe(at(2027, 10, 15));
  });

  it("le 31 devient le dernier jour des mois plus courts, puis redevient le 31", () => {
    const rule = withAnchors({ freq: "monthly" }, at(2027, 1, 31)); // monthDay 31 gardé
    const feb = nextOccurrence(rule, at(2027, 1, 31), at(2027, 1, 31, 10));
    expect(feb).toBe(at(2027, 2, 28));
    const mar = nextOccurrence(rule, feb, feb + HOUR);
    expect(mar).toBe(at(2027, 3, 31));
    expect(nextOccurrence(rule, mar, mar + HOUR)).toBe(at(2027, 4, 30));
    // Année bissextile
    expect(nextOccurrence(rule, at(2028, 1, 31), at(2028, 1, 31, 10))).toBe(at(2028, 2, 29));
  });

  it("29 février : le 28 les autres années, le 29 les années bissextiles", () => {
    const rule = withAnchors({ freq: "yearly" }, at(2028, 2, 29));
    expect(rule).toEqual({ freq: "yearly", month: 1, monthDay: 29 });
    const y2029 = nextOccurrence(rule, at(2028, 2, 29), at(2028, 2, 29, 10));
    expect(y2029).toBe(at(2029, 2, 28));
    expect(nextOccurrence(rule, at(2031, 2, 28), at(2031, 2, 28, 10))).toBe(at(2032, 2, 29));
  });

  it("changement d'heure : l'occurrence reste à la même heure locale", () => {
    // Passage à l'heure d'hiver le 25 octobre 2026, à l'heure d'été le 28 mars 2027 (Europe)
    const autumn = next({ freq: "daily" }, at(2026, 10, 24), at(2026, 10, 24, 10));
    expect(autumn).toBe(at(2026, 10, 25));
    expect(new Date(autumn).getHours()).toBe(9);
    const spring = next({ freq: "weekly" }, at(2027, 3, 22, 8, 30), at(2027, 3, 22, 10));
    expect(new Date(spring).getHours()).toBe(8);
    expect(new Date(spring).getMinutes()).toBe(30);
  });

  it("pas de rattrapage : après un mois d'absence, la prochaine occurrence est à venir", () => {
    const now = at(2026, 10, 22, 12);
    const result = next({ freq: "daily" }, now - 30 * DAY, now);
    expect(result).toBe(at(2026, 10, 23, 12)); // même heure que l'échéance
  });

  it("terminée en avance : l'occurrence suivante vient après l'échéance actuelle", () => {
    // Échéance vendredi, terminée mercredi : vendredi suivant
    expect(next({ freq: "weekly" }, at(2026, 10, 23), at(2026, 10, 21, 12))).toBe(at(2026, 10, 30));
  });

  it("échéance proposée : la prochaine occurrence à 9 h", () => {
    expect(proposedDue({ freq: "daily" }, at(2026, 10, 22, 8))).toBe(at(2026, 10, 22));
    expect(proposedDue({ freq: "daily" }, at(2026, 10, 22, 10))).toBe(at(2026, 10, 23));
    expect(proposedDue({ freq: "weekdays" }, at(2026, 10, 24, 10))).toBe(at(2026, 10, 26)); // samedi
  });

  it("libellés de la puce", () => {
    expect(recurrenceLabel({ freq: "weekly", days: [4, 1] })).toBe("Chaque semaine · Lun, Jeu");
    expect(recurrenceLabel({ freq: "monthly", monthDay: 31 })).toBe("Chaque mois");
    expect(recurrenceLabel({ freq: "weekdays" })).toBe("Jours de semaine");
  });
});

describe("terminer une tâche récurrente", () => {
  const SETTINGS: Settings = { ...DEFAULT_SETTINGS, quietHoursStart: "00:00", quietHoursEnd: "00:00", weeklyReview: false };
  const scheduled = () =>
    (Notifications as unknown as { __state: { scheduled: { content: { data: { taskId: string } } }[] } }).__state
      .scheduled;
  const scheduledFor = () => [...new Set(scheduled().map((n) => n.content.data.taskId))];

  const setup = async (task: Partial<Task>) => {
    await AsyncStorage.clear();
    const due = new Date(Date.now() + 3 * DAY);
    due.setSeconds(0, 0);
    const dueAt = due.getTime();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([
        makeTask({
          id: "r",
          title: "Sortir les poubelles",
          category: "INU",
          dueAt,
          reminderOffset: 60,
          recurrence: withAnchors({ freq: "weekly" }, dueAt),
          ...task,
        }),
      ])
    );
    const hook = await renderHook(() => useTasks(SETTINGS));
    await waitFor(() => expect(scheduledFor()).toEqual(["r"]));
    return { ...hook, dueAt };
  };

  it("passe en terminée et crée l'occurrence suivante, avec ses notifications", async () => {
    const { result, dueAt } = await setup({});
    await act(() => result.current.toggleDone("r"));

    const [done, created] = result.current.tasks;
    expect(done).toMatchObject({ id: "r", isDone: true, completedAt: expect.any(Number) });
    expect(created).toMatchObject({
      title: "Sortir les poubelles",
      category: "INU",
      isDone: false,
      reminderOffset: 60,
      recurrence: done.recurrence,
      dueAt: dueAt + 7 * DAY,
    });
    expect(created.id).not.toBe("r");
    expect(done.nextOccurrenceId).toBe(created.id);
    // Journal : une seule entrée, celle de la tâche terminée
    expect(result.current.completions).toHaveLength(1);
    // Notifications : celles de la nouvelle occurrence, plus aucune de l'ancienne
    await waitFor(() => expect(scheduledFor()).toEqual([created.id]));
  });

  it("« Annuler » supprime l'occurrence créée et reprogramme la tâche", async () => {
    const { result } = await setup({});
    await act(() => result.current.toggleDone("r"));
    const created = result.current.tasks[1].id;
    await waitFor(() => expect(scheduledFor()).toEqual([created]));

    await act(() => result.current.toggleDone("r"));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]).toMatchObject({ id: "r", isDone: false, nextOccurrenceId: null });
    expect(result.current.completions).toEqual([]);
    await waitFor(() => expect(scheduledFor()).toEqual(["r"]));
  });

  it("« Fait » depuis une notification crée aussi l'occurrence suivante", async () => {
    const { result } = await setup({});
    await act(() => result.current.completeTask("r"));
    expect(result.current.tasks).toHaveLength(2);
  });

  it("passée en Faire (escalade), elle garde sa répétition ; la suivante revient dans Planifier", async () => {
    const { result } = await setup({});
    await act(() => result.current.moveTask("r", "UI"));
    expect(result.current.tasks[0]).toMatchObject({ category: "UI", recurrence: expect.any(Object) });
    expect(result.current.tasks[0].dueAt).not.toBeNull();

    await act(() => result.current.toggleDone("r"));
    expect(result.current.tasks[1]).toMatchObject({ category: "INU", reminderOffset: 60 });
    // Le journal garde la catégorie au moment de la fin
    expect(result.current.completions[0].category).toBe("UI");
  });

  it("« Arrêter de répéter » : plus d'occurrence suivante", async () => {
    const { result } = await setup({});
    await act(() => result.current.updateTask("r", { recurrence: null }));
    await act(() => result.current.toggleDone("r"));
    expect(result.current.tasks).toHaveLength(1);
  });

  it("déplacée vers Déléguer ou Si j'ai le temps : la répétition s'arrête", async () => {
    const { result } = await setup({});
    await act(() => result.current.moveTask("r", "UDI"));
    expect(result.current.tasks[0].recurrence).toBeNull();
  });

  it("supprimer ne supprime que l'occurrence affichée", async () => {
    const { result } = await setup({});
    await act(() => result.current.toggleDone("r"));
    const created = result.current.tasks[1].id;
    await act(() => result.current.removeTask(created));
    expect(result.current.tasks.map((t) => t.id)).toEqual(["r"]);
  });
});

describe("fiche : « Répéter »", () => {
  it("propose une échéance et le jour de la semaine, avec un « i »", async () => {
    const onSubmit = jest.fn();
    await render(<TaskForm initialCategory="INU" settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    expect(screen.getByLabelText("En savoir plus : Répéter")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "Jamais" })).toBeSelected();

    await fireEvent.press(screen.getByRole("radio", { name: "Chaque semaine" }));
    expect(screen.queryByText("Ajouter une échéance")).toBeNull();
    const checked = screen.getAllByRole("checkbox").filter((c) => c.props.accessibilityState?.checked);
    expect(checked).toHaveLength(1);

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Sortir les poubelles");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Jeu" }));
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    const values = onSubmit.mock.calls[0][0];
    expect(values.dueAt).toEqual(expect.any(Number));
    expect(values.recurrence.freq).toBe("weekly");
    expect(values.recurrence.days).toContain(4);
  });

  it("retirer l'échéance arrête la répétition", async () => {
    await render(<TaskForm initialCategory="INU" settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Chaque jour" }));
    await fireEvent.press(screen.getByRole("button", { name: "Retirer l'échéance" }));
    expect(screen.getByRole("radio", { name: "Jamais" })).toBeSelected();
  });

  it("« Arrêter de répéter » sur une tâche récurrente", async () => {
    const onSubmit = jest.fn();
    const dueAt = Date.now() + 3 * DAY;
    const task = makeTask({ category: "INU", title: "Loyer", dueAt, recurrence: withAnchors({ freq: "monthly" }, dueAt) });
    await render(<TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    expect(screen.getByRole("radio", { name: "Chaque mois" })).toBeSelected();

    await fireEvent.press(screen.getByRole("button", { name: "Arrêter de répéter" }));
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ recurrence: null, dueAt });
  });

  it("garde le 31 voulu quand l'échéance affichée est le 30", async () => {
    const onSubmit = jest.fn();
    const dueAt = at(2027, 4, 30);
    const task = makeTask({ category: "INU", title: "Loyer", dueAt, recurrence: { freq: "monthly", monthDay: 31 } });
    await render(<TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0].recurrence).toEqual({ freq: "monthly", monthDay: 31 });
  });
});

describe("carte et escalade", () => {
  it("puce « répétition » sur la carte", async () => {
    const dueAt = Date.now() + 3 * DAY;
    await render(
      <TaskChips
        task={makeTask({ category: "INU", dueAt, recurrence: { freq: "weekly", days: [1, 4] } })}
        category={CATEGORY_BY_KEY.INU}
      />
    );
    expect(screen.getByText("Chaque semaine · Lun, Jeu")).toBeOnTheScreen();
  });

  it("une routine quotidienne n'est jamais « bientôt urgente »", () => {
    const now = Date.now();
    const soon = (recurrence: Recurrence | null) =>
      isSoonUrgent(makeTask({ category: "INU", dueAt: now + 5 * HOUR, recurrence }), now);
    expect(soon({ freq: "daily" })).toBe(false);
    expect(soon({ freq: "weekdays" })).toBe(false);
    expect(soon({ freq: "weekly", days: [1] })).toBe(true);
    expect(soon(null)).toBe(true);
  });
});
