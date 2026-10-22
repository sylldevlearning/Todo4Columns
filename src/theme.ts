// Thème sombre de l'application
export const colors = {
  bg: "#0F1115",
  surface: "#1A1D24",
  surfaceRaised: "#232731",
  border: "#2A2E37",
  text: "#F3F4F6",
  textMuted: "#A1A7B3",
  success: "#2FA578",
  danger: "#E5484D",
  white: "#FFFFFF",
};

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
