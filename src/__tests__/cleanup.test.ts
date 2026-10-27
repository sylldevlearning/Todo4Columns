import { planStepCelebration } from "../celebration/plan";
import { SAVE_DELAY_MS } from "../hooks/batching";
import { SAVE_DELAY_MS as fromUseTasks } from "../hooks/useTasks";

// Source d'un fichier de src/ (Jest tourne à la racine du projet)
const { readFileSync } = require("fs") as { readFileSync: (file: string, encoding: string) => string };
const source = (file: string) => readFileSync(`src/${file}`, "utf8");

describe("nettoyage", () => {
  it("étape cochée : aucun style de confettis inutilisé", () => {
    expect(planStepCelebration({ enabled: true })).toEqual({ style: null, confetti: false, haptic: "light" });
    expect(planStepCelebration({ enabled: false })).toBeNull();
  });

  it("le journal ne dépend plus de la sauvegarde des tâches pour son délai", () => {
    expect(source("hooks/useCompletionLog.ts")).not.toMatch(/from "\.\/useTaskSaving"/);
    expect(fromUseTasks).toBe(SAVE_DELAY_MS);
  });
});

describe("« dernière étape → Terminer la tâche ? » : un seul utilitaire", () => {
  const { Alert } = require("react-native");
  const { offerToFinishAfterStep } = require("../finishPrompt");
  const step = (id: string, done: boolean) => ({ id, title: id, done, doneAt: done ? 1 : null, day: null, time: null });

  it("pose la question seulement quand l'étape cochée était la dernière à faire", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    alert.mockClear();
    expect(offerToFinishAfterStep([step("a", true), step("b", false)], "b", () => {})).toBe(true);
    expect(offerToFinishAfterStep([step("a", false), step("b", false)], "b", () => {})).toBe(false);
    expect(offerToFinishAfterStep([step("a", true)], "inconnue", () => {})).toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("utilisé par la carte (quadrant), la fiche et le rappel d'étape ; stepsOf partout", () => {
    for (const file of ["../app/quadrant/[category].tsx", "components/TaskForm.tsx", "../app/_layout.tsx"]) {
      expect(source(file)).toContain("offerToFinishAfterStep(");
    }
    expect(source("components/StepSummary.tsx")).not.toContain("askToFinish");
    expect(source("../app/_layout.tsx")).not.toMatch(/\.steps \?\? \[\]/);
  });
});
