import { Dispatch, MutableRefObject, SetStateAction, useEffect, useState } from "react";
import { AppState } from "react-native";
import { shouldEscalate } from "../notifications/status";
import { pickReminderFields } from "../reminders";
import { Settings } from "../settings";
import { Category, ReminderFields, Task } from "../types";
import { MAX_TIMEOUT_MS } from "./useTimers";

// Dernière bascule automatique en Faire, avec les tâches telles qu'elles étaient (« Annuler »)
export interface Escalation {
  before: Task[];
}

interface Options {
  tasks: Task[];
  tasksRef: MutableRefObject<Task[]>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  settings: Settings;
  settingsRef: MutableRefObject<Settings>;
  isLoaded: boolean;
  settingsReady: boolean;
  foreground: boolean;
  // Rappels d'une tâche déplacée dans un autre quadrant (valeurs par défaut du quadrant)
  movedFields: (t: Task, category: Category) => ReminderFields;
}

// Bascule automatique des tâches « Planifier » en retard dans « Faire », avec « Annuler »
export function useEscalation({
  tasks,
  tasksRef,
  setTasks,
  settings,
  settingsRef,
  isLoaded,
  settingsReady,
  foreground,
  movedFields,
}: Options) {
  const [escalation, setEscalation] = useState<Escalation | null>(null);
  // Fait avancer la vérification suivante (délai plafonné à MAX_TIMEOUT_MS)
  const [escalationTick, setEscalationTick] = useState(0);

  // Passe en Faire les tâches « Planifier » dont l'échéance est dépassée. Les relances partent
  // de maintenant ; les notifications sont reprogrammées selon la nouvelle catégorie.
  const escalateOverdue = () => {
    if (!settingsRef.current.autoEscalate) return;
    const now = Date.now();
    const overdue = tasksRef.current.filter((t) => shouldEscalate(t, now));
    if (overdue.length === 0) return;
    const ids = new Set(overdue.map((t) => t.id));
    setTasks((prev) =>
      prev.map((t) =>
        ids.has(t.id) && shouldEscalate(t, now)
          ? {
              ...t,
              category: "UI",
              ...movedFields(t, "UI"),
              updatedAt: now,
              categoryChangedAt: now,
              snoozedUntil: null,
            }
          : t
      )
    );
    setEscalation((current) => ({
      // Plusieurs bascules avant « Annuler » : toutes sont annulables
      before: [...(current?.before.filter((t) => !ids.has(t.id)) ?? []), ...overdue],
    }));
  };

  // « Annuler » : les tâches reviennent dans « Planifier » telles qu'elles étaient, et ne
  // rebasculent plus pour cette échéance
  const undoEscalation = () => {
    const before = new Map((escalation?.before ?? []).map((t) => [t.id, t]));
    const now = Date.now();
    setTasks((prev) =>
      prev.map((t) => {
        const old = before.get(t.id);
        if (!old || t.category !== "UI" || t.isDone) return t;
        return {
          ...t,
          category: old.category,
          ...pickReminderFields(old),
          categoryChangedAt: old.categoryChangedAt,
          escalationSkippedFor: old.dueAt,
          updatedAt: now,
          snoozedUntil: null,
        };
      })
    );
    setEscalation(null);
  };

  const dismissEscalation = () => setEscalation(null);

  // Au démarrage (réglages lus), au retour dans l'app, à l'heure de l'échéance si l'app est
  // ouverte, et quand le réglage est activé. Rien en arrière-plan.
  useEffect(() => {
    if (!isLoaded || !settingsReady || !settings.autoEscalate || !foreground) return;
    const now = Date.now();
    if (tasks.some((t) => shouldEscalate(t, now))) {
      escalateOverdue();
      return;
    }
    const upcoming = tasks
      .filter((t) => t.category === "INU" && !t.isDone && t.archivedAt === null && t.dueAt !== null)
      .map((t) => t.dueAt!)
      .filter((due) => due > now);
    if (upcoming.length === 0) return;
    const timeout = setTimeout(
      () => setEscalationTick((n) => n + 1),
      Math.min(Math.min(...upcoming) - now + 50, MAX_TIMEOUT_MS)
    );
    return () => clearTimeout(timeout);
  }, [tasks, isLoaded, settingsReady, settings.autoEscalate, escalationTick, foreground]);

  // Retour dans l'app : vérification même si l'état n'a pas changé entre-temps
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setEscalationTick((n) => n + 1);
    });
    return () => subscription.remove();
  }, []);

  return { escalation, undoEscalation, dismissEscalation };
}
