import { AppState, Share } from "react-native";
import { formatDay } from "./format";
import { t } from "./i18n";
import { Task } from "./types";

// Délégation par message : le partage natif s'ouvre avec un texte prêt. L'utilisateur choisit
// l'appli et le destinataire ; l'app n'a aucun accès aux contacts.

// « Salut Marie, peux-tu t'occuper de : Compte rendu ? (avant le vendredi 24 octobre) Merci ! »
export const delegationMessage = (task: Pick<Task, "title" | "delegatedTo" | "dueAt">) =>
  t.delegation.message(
    task.delegatedTo,
    task.title,
    task.dueAt !== null ? formatDay(task.dueAt) : null
  );

// « Petit rappel : où en es-tu pour Compte rendu ? »
export const nudgeMessage = (task: Pick<Task, "title">) => t.delegation.nudgeMessage(task.title);

export async function shareMessage(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch (e) {
    console.warn("Partage impossible :", e);
  }
}

// Depuis une notification : le partage s'ouvre une fois l'app revenue au premier plan
export function shareWhenActive(message: string): void {
  if (AppState.currentState === "active") {
    shareMessage(message);
    return;
  }
  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    subscription.remove();
    shareMessage(message);
  });
}
