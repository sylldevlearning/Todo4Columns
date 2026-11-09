import { useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import type { Category } from "./types";

// Thèmes clair et sombre de l'application. Toutes les couleurs de l'app sont ici : les composants
// les lisent par `colors` (et les quadrants par src/constants/categories.ts), toujours celles du
// thème courant. Réglage « Apparence » : automatique (suit le téléphone), clair ou sombre.

export type Scheme = "light" | "dark";
export type AppearancePreference = "auto" | "light" | "dark";
export const APPEARANCES: AppearancePreference[] = ["auto", "light", "dark"];

export interface QuadrantColors {
  color: string; // couleur du quadrant (aplats, icônes, points)
  textColor: string; // texte coloré sur le fond de l'app ou une teinte légère du quadrant
  onColor: string; // texte posé sur la couleur du quadrant
  sparkle: string; // confettis : variante claire (thème sombre) ou moyenne (thème clair)
}

export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  success: string;
  warning: string; // tâche en attente
  danger: string;
  white: string;
  overlay: string; // voile léger sur une surface (blanc en sombre, encre en clair), avec withAlpha
  backdrop: string; // fond derrière une fenêtre
  shadow: string;
  confetti: string; // confettis neutres
  brand: string; // couleur de l'app (notifications, icône)
  quadrants: Record<Category, QuadrantColors>;
}

const DARK: Palette = {
  bg: "#0F1115",
  surface: "#1A1D24",
  surfaceRaised: "#232731",
  border: "#2A2E37",
  text: "#F3F4F6",
  textMuted: "#A1A7B3",
  success: "#2FA578",
  warning: "#F2B33D",
  danger: "#F45F63", // éclairci en 1.6 : au moins 4,5:1 sur les surfaces
  white: "#FFFFFF",
  overlay: "#FFFFFF",
  backdrop: "rgba(0, 0, 0, 0.55)",
  shadow: "#000000",
  confetti: "#FFFFFF",
  brand: "#FF7A59",
  quadrants: {
    UI: { color: "#FF7A59", textColor: "#FF9677", onColor: "#1A0F0B", sparkle: "#FFC4B2" },
    INU: { color: "#5B9BFF", textColor: "#8BB8FF", onColor: "#0B1220", sparkle: "#C9DEFF" },
    UDI: { color: "#F2B33D", textColor: "#F5C566", onColor: "#1C1405", sparkle: "#FFE2A3" },
    NDNI: { color: "#8B92A0", textColor: "#B5BAC4", onColor: "#111318", sparkle: "#D5D8DE" },
  },
};

// Couleurs des quadrants plus foncées pour rester lisibles sur fond clair ; textes encore plus
// foncés (au moins 4,5:1 sur le fond et les teintes légères, vérifié par les tests)
const LIGHT: Palette = {
  bg: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceRaised: "#EEF0F3",
  border: "#E3E6EB",
  text: "#14161A",
  textMuted: "#5B6270",
  success: "#1E7F55",
  warning: "#8A5A12",
  danger: "#C2373B",
  white: "#FFFFFF",
  overlay: "#14161A",
  backdrop: "rgba(20, 22, 26, 0.45)",
  shadow: "#000000",
  confetti: "#9AA1AE",
  brand: "#FF7A59",
  quadrants: {
    UI: { color: "#D9532F", textColor: "#A63C1C", onColor: "#140602", sparkle: "#F28B6E" },
    INU: { color: "#2F6FDB", textColor: "#1F55B5", onColor: "#FFFFFF", sparkle: "#6E9BEA" },
    UDI: { color: "#B7791F", textColor: "#7A4F0E", onColor: "#1F1405", sparkle: "#E0A53A" },
    NDNI: { color: "#6B7280", textColor: "#4B5160", onColor: "#FFFFFF", sparkle: "#A3A9B5" },
  },
};

export const PALETTES: Record<Scheme, Palette> = { light: LIGHT, dark: DARK };

// ---- Thème courant ----

let preference: AppearancePreference = "auto";
const systemScheme = (): Scheme => (Appearance.getColorScheme() === "light" ? "light" : "dark");
let scheme: Scheme = systemScheme();
const listeners = new Set<() => void>();

export const getScheme = () => scheme;
export const getAppearancePreference = () => preference;
export const palette = (): Palette => PALETTES[scheme];

function update() {
  const next = preference === "auto" ? systemScheme() : preference;
  if (next === scheme) return;
  scheme = next;
  listeners.forEach((l) => l());
}

// Réglage « Apparence » : appliqué tout de suite (et aux fenêtres du système : alertes,
// sélecteurs de date, qui suivent le mode clair ou sombre de l'app)
export function setAppearancePreference(next: AppearancePreference): void {
  if (next === preference) return;
  preference = next;
  watchSystem();
  try {
    Appearance.setColorScheme?.(next === "auto" ? "unspecified" : next);
  } catch {
    // Plateforme sans réglage du mode (web) : seul le thème de l'app change
  }
  update();
}

// Automatique : le thème suit celui du téléphone, à chaud (écoute branchée au premier abonnement)
let systemSubscription: { remove: () => void } | null = null;
function watchSystem() {
  systemSubscription ??= Appearance.addChangeListener(() => {
    if (preference === "auto") update();
  });
}

export function subscribeScheme(listener: () => void): () => void {
  watchSystem();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Thème courant ; le composant est redessiné quand il change (à appeler dans chaque écran et
// dans les composants mémorisés)
export const useScheme = (): Scheme => useSyncExternalStore(subscribeScheme, getScheme, getScheme);

// Tests : thème par défaut
export function resetThemeForTests(): void {
  preference = "auto";
  scheme = systemScheme();
  listeners.clear();
  systemSubscription?.remove();
  systemSubscription = null;
}

// Couleurs du thème courant, lues à chaque accès (colors.text…)
type FlatPalette = Omit<Palette, "quadrants">;
export const colors = Object.defineProperties(
  {},
  Object.fromEntries(
    (Object.keys(DARK) as (keyof Palette)[])
      .filter((k) => k !== "quadrants")
      .map((k) => [k, { get: () => PALETTES[scheme][k], enumerable: true }])
  )
) as Readonly<FlatPalette>;

// Feuille de styles recalculée pour chaque thème (puis gardée) : même usage que StyleSheet.create
// au niveau du module, `styles.carte` renvoie toujours le style du thème courant
export function themedStyles<T extends object>(factory: () => T): T {
  const cache: Partial<Record<Scheme, T>> = {};
  const current = () => (cache[scheme] ??= factory());
  return new Proxy({} as T, {
    get: (_, key) => current()[key as keyof T],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => Object.getOwnPropertyDescriptor(current(), key),
  });
}

// Manrope, chargée dans app/_layout.tsx
export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
};

// Taille minimale d'une zone tactile
export const TOUCH_SIZE = 44;

// "#RRGGBB" + opacité (0-1) -> "rgba(...)"
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
