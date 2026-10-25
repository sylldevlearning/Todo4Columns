import { useEffect, useState } from "react";
import { AppState } from "react-native";

// App à l'écran ; un état inconnu (démarrage, tests) compte comme à l'écran
export const isForeground = (state: string | null | undefined) =>
  state !== "background" && state !== "inactive";

// Suit le passage de l'app à l'écran et hors de l'écran
export function useForeground(): boolean {
  const [foreground, setForeground] = useState(isForeground(AppState.currentState));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(isForeground(state)));
    return () => subscription.remove();
  }, []);
  return foreground;
}
