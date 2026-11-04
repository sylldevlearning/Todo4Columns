import { Dispatch, SetStateAction } from "react";
import { postponeStepIn, stepsOf, toggleStepIn } from "../steps";
import { Task } from "../types";

// Étapes cochées ou reportées hors de la fiche (carte, notification). updatedAt ne change pas :
// il sert de point de départ aux relances de la tâche.
export function useSteps(setTasks: Dispatch<SetStateAction<Task[]>>) {
  const changeSteps = (taskId: string, change: (task: Task) => Task["steps"]) =>
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const steps = change(t);
        return steps === t.steps ? t : { ...t, steps };
      })
    );

  // Coche ou décoche une étape
  const toggleStep = (taskId: string, stepId: string) =>
    changeSteps(taskId, (t) => toggleStepIn(stepsOf(t), stepId, Date.now()));

  // « Fait » depuis une notification : ne décoche jamais une étape déjà faite
  const completeStep = (taskId: string, stepId: string) =>
    changeSteps(taskId, (t) =>
      stepsOf(t).some((s) => s.id === stepId && !s.done)
        ? toggleStepIn(stepsOf(t), stepId, Date.now())
        : t.steps
    );

  // « Reporter à demain »
  const postponeStep = (taskId: string, stepId: string) =>
    changeSteps(taskId, (t) =>
      stepsOf(t).some((s) => s.id === stepId && !s.done)
        ? postponeStepIn(stepsOf(t), stepId, Date.now())
        : t.steps
    );

  return { toggleStep, completeStep, postponeStep };
}
