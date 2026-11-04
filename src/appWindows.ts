import { useEffect } from "react";
import { Alert, AlertButton, AlertOptions } from "react-native";
import { t } from "./i18n";

// Fenêtres de l'app ouvertes (fiche, alerte, carte d'autorisation, message de bascule) : la demande
// d'avis attend qu'il n'y en ait plus aucune
const open = new Set<string>();
let lastAlertId = 0;

export const markWindowOpen = (key: string) => {
  open.add(key);
};
export const markWindowClosed = (key: string) => {
  open.delete(key);
};
export const isAnyWindowOpen = () => open.size > 0;

// Fenêtre visible tant que visible est vrai et le composant monté
export function useWindowOpen(key: string, visible: boolean = true): void {
  useEffect(() => {
    if (!visible) return;
    markWindowOpen(key);
    return () => markWindowClosed(key);
  }, [key, visible]);
}

// Alert.alert suivie : ouverte jusqu'au choix d'un bouton ou à sa fermeture (retour, appui à côté)
export function showAlert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
  const key = `alert-${++lastAlertId}`;
  markWindowOpen(key);
  const close = () => markWindowClosed(key);
  Alert.alert(
    title,
    message,
    (buttons ?? [{ text: t.common.ok }]).map((button) => ({
      ...button,
      onPress: (value?: string) => {
        close();
        (button.onPress as ((value?: string) => void) | undefined)?.(value);
      },
    })),
    {
      ...options,
      onDismiss: () => {
        close();
        options?.onDismiss?.();
      },
    }
  );
}
