import { CATEGORY_BY_KEY } from "../constants/categories";
import { Category } from "../types";

// Durées : les confettis retombent en ~1,7 s, le message reste ~2,6 s au total
export const CONFETTI_MS = 1700;
export const CELEBRATION_MS = 2600;

// Physique des confettis (px, s) : frottement de l'air et gravité
export const DRAG = 2.4;
export const GRAVITY = 900;

export type HapticKind = "success" | "light";

export interface CelebrationStyle {
  count: number; // nombre de confettis
  colors: string[];
  power: number; // vitesse de l'explosion
  haptic: HapticKind;
}

const c = (key: Category) => CATEGORY_BY_KEY[key];

// Intensité par quadrant : Planifier > Faire > Déléguer > Si j'ai le temps
export const CELEBRATION_STYLES: Record<Category, CelebrationStyle> = {
  // Planifier : la plus forte, bleus du quadrant rehaussés des autres couleurs
  INU: {
    count: 90,
    colors: [c("INU").color, c("INU").textColor, "#C9DEFF", c("UI").color, c("UDI").color, "#FFFFFF"],
    power: 1.25,
    haptic: "success",
  },
  UI: {
    count: 60,
    colors: [c("UI").color, c("UI").textColor, "#FFC4B2", "#FFFFFF"],
    power: 1.1,
    haptic: "success",
  },
  UDI: {
    count: 30,
    colors: [c("UDI").color, c("UDI").textColor, "#FFE2A3"],
    power: 0.85,
    haptic: "light",
  },
  NDNI: {
    count: 10,
    colors: [c("NDNI").color, c("NDNI").textColor],
    power: 0.6,
    haptic: "light",
  },
};

export interface CelebrationPlan {
  style: CelebrationStyle;
  confetti: boolean; // false si l'option « Réduire les animations » du téléphone est active
  haptic: HapticKind;
}

// Ce qui doit se passer quand une tâche du quadrant est terminée ; null = rien du tout
export function planCelebration(
  category: Category,
  { enabled, reduceMotion }: { enabled: boolean; reduceMotion: boolean }
): CelebrationPlan | null {
  if (!enabled) return null;
  const style = CELEBRATION_STYLES[category];
  return { style, confetti: !reduceMotion, haptic: style.haptic };
}

export interface Particle {
  vx: number; // vitesse initiale, px/s
  vy: number;
  size: number;
  color: string;
  round: boolean;
  spin: number; // rotation, degrés/s
  flip: number; // vitesse du retournement (effet 3D), rad/s
}

// Confettis projetés vers le haut en éventail (~200°)
export function makeParticles(style: CelebrationStyle, random: () => number = Math.random): Particle[] {
  return Array.from({ length: style.count }, (_, i) => {
    const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 1.1;
    const speed = (260 + random() * 420) * style.power;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + random() * 6,
      color: style.colors[i % style.colors.length],
      round: random() < 0.3,
      spin: (random() - 0.5) * 1440,
      flip: 4 + random() * 8,
    };
  });
}

// Position d'un confetti t secondes après l'explosion (frottement linéaire + gravité)
export function particleOffset(p: Particle, t: number): { x: number; y: number } {
  "worklet";
  const travel = (1 - Math.exp(-DRAG * t)) / DRAG;
  const terminal = GRAVITY / DRAG;
  return {
    x: p.vx * travel,
    y: (p.vy - terminal) * travel + terminal * t,
  };
}
