import type { HexColor, RgbaColor } from "react-native-android-widget";
import { CATEGORIES } from "../constants/categories";
import { colors, withAlpha } from "../theme";
import { Category } from "../types";

type WidgetColor = HexColor | RgbaColor;

// Couleurs d'un widget (les vues natives demandent des couleurs « #RRGGBB » ou « rgba(…) »)
export interface WidgetPalette {
  bg: WidgetColor;
  surfaceRaised: WidgetColor;
  text: WidgetColor;
  textMuted: WidgetColor;
  quadrant: Record<Category, { color: WidgetColor; textColor: WidgetColor; tint: WidgetColor }>;
}

const hex = (c: string) => c as HexColor;

// Palette du thème courant de l'app
export function widgetPalette(): WidgetPalette {
  return {
    bg: hex(colors.bg),
    surfaceRaised: hex(colors.surfaceRaised),
    text: hex(colors.text),
    textMuted: hex(colors.textMuted),
    quadrant: Object.fromEntries(
      CATEGORIES.map((c) => [
        c.key,
        { color: hex(c.color), textColor: hex(c.textColor), tint: withAlpha(c.color, 0.14) as RgbaColor },
      ])
    ) as WidgetPalette["quadrant"],
  };
}
