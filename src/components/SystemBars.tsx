import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform, StatusBar } from "react-native";
import { colors, useScheme } from "../theme";

// Barre d'état, barre de navigation Android et fond de la fenêtre aux couleurs du thème courant :
// icônes claires sur le thème sombre, foncées sur le thème clair
export default function SystemBars() {
  const scheme = useScheme();
  useEffect(() => {
    StatusBar.setBarStyle(scheme === "dark" ? "light-content" : "dark-content", true);
    if (Platform.OS === "android") {
      try {
        NavigationBar.setStyle(scheme === "dark" ? "light" : "dark");
      } catch {
        // Module natif absent (Expo Go, tests)
      }
    }
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [scheme]);
  return null;
}
