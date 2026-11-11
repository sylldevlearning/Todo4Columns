import type { HexColor, RgbaColor } from "react-native-android-widget";
import { CATEGORIES } from "../constants/categories";
import { PALETTES, Scheme, withAlpha } from "../theme";
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

// Palette d'un thème de l'app
export function widgetPalette(scheme: Scheme): WidgetPalette {
  const p = PALETTES[scheme];
  return {
    bg: hex(p.bg),
    surfaceRaised: hex(p.surfaceRaised),
    text: hex(p.text),
    textMuted: hex(p.textMuted),
    quadrant: Object.fromEntries(
      CATEGORIES.map(({ key }) => {
        const q = p.quadrants[key];
        return [key, { color: hex(q.color), textColor: hex(q.textColor), tint: withAlpha(q.color, 0.14) as RgbaColor }];
      })
    ) as WidgetPalette["quadrant"],
  };
}
