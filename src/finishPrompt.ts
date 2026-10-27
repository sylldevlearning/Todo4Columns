import { Alert } from "react-native";
import { t } from "./i18n";

// Dernière étape cochée : « Terminer la tâche ? » ; « Terminer » lance onFinish
export function askToFinish(onFinish: () => void): void {
  Alert.alert(t.steps.finishTitle, t.steps.finishBody, [
    { text: t.steps.finishNo, style: "cancel" },
    { text: t.steps.finishYes, onPress: onFinish },
  ]);
}
