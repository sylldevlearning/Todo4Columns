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
