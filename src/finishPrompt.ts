import { Alert } from "react-native";
import { t } from "./i18n";
import { TaskStep } from "./types";

// « Terminer la tâche ? » ; « Terminer » lance onFinish
export function askToFinish(onFinish: () => void): void {
  Alert.alert(t.steps.finishTitle, t.steps.finishBody, [
    { text: t.steps.finishNo, style: "cancel" },
    { text: t.steps.finishYes, onPress: onFinish },
  ]);
}

// Étape checkedId cochée : si c'était la dernière à faire, propose de terminer la tâche.
// Utilisé par la fiche, la carte et le rappel d'étape ; renvoie true si la question est posée.
export function offerToFinishAfterStep(steps: TaskStep[], checkedId: string, onFinish: () => void): boolean {
  if (!steps.some((s) => s.id === checkedId) || !steps.every((s) => s.done || s.id === checkedId)) return false;
  askToFinish(onFinish);
  return true;
}
