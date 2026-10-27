import * as Haptics from "expo-haptics";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from "react-native";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { Category } from "../types";
import CelebrationMessage from "./CelebrationMessage";
import Confetti, { Point } from "./Confetti";
import { createMessagePicker } from "./messages";
import {
  CELEBRATION_MS,
  CelebrationPlan,
  HapticKind,
  planCelebration,
  planStepCelebration,
} from "./plan";
import { useReduceMotion } from "./useReduceMotion";

// Délai maximal pour connaître la position de la tâche ; au-delà, l'explosion part du centre
const ORIGIN_TIMEOUT_MS = 120;

// Élément dont on peut lire la position à l'écran (la carte de la tâche)
export type Anchor = { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void };

interface CelebrationApi {
  // Lance la célébration d'une tâche terminée ; renvoie son identifiant, ou null si rien n'est joué
  celebrate: (category: Category, anchor?: Anchor | null) => number | null;
  // Étape cochée : petit message et retour haptique léger, sans confettis
  celebrateStep: (category: Category) => number | null;
  // Fait disparaître la célébration (toutes, ou seulement celle indiquée)
  dismiss: (id?: number) => void;
  // Une célébration est à l'écran (rien ne doit s'afficher par-dessus)
  isCelebrating: () => boolean;
}

const CelebrationContext = createContext<CelebrationApi>({
  celebrate: () => null,
  celebrateStep: () => null,
  dismiss: () => {},
  isCelebrating: () => false,
});

export const useCelebration = () => useContext(CelebrationContext);

interface Active {
  id: number;
  category: Category;
  message: string;
  plan: CelebrationPlan;
  origin: Point | null; // null tant que la position de la tâche n'est pas connue
}

function playHaptic(kind: HapticKind) {
  const done =
    kind === "success"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  done?.catch(() => {});
}

// Affiche confettis et message par-dessus l'app, sans jamais intercepter les touches
export function CelebrationProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const latest = useRef({ enabled, reduceMotion, width, height });
  latest.current = { enabled, reduceMotion, width, height };
  const pickMessage = useRef(createMessagePicker()).current;
  const lastId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const celebrate = useCallback((category: Category, anchor?: Anchor | null) => {
    const { enabled, reduceMotion, width, height } = latest.current;
    const plan = planCelebration(category, { enabled, reduceMotion });
    if (!plan) return null;

    // Une nouvelle célébration remplace la précédente
    clearTimers();
    const id = ++lastId.current;
    const message = pickMessage(category);
    playHaptic(plan.haptic);
    AccessibilityInfo.announceForAccessibility(message);
    setActive({ id, category, message, plan, origin: null });

    if (plan.confetti) {
      const place = (origin: Point) =>
        setActive((c) => (c?.id === id && c.origin === null ? { ...c, origin } : c));
      timers.current.push(
        setTimeout(() => place({ x: width / 2, y: height * 0.45 }), ORIGIN_TIMEOUT_MS)
      );
      anchor?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) place({ x: x + w / 2, y: y + h / 2 });
      });
    }

    timers.current.push(
      setTimeout(() => setActive((c) => (c?.id === id ? null : c)), CELEBRATION_MS)
    );
    return id;
  }, []);

  const celebrateStep = useCallback((category: Category) => {
    const plan = planStepCelebration({ enabled: latest.current.enabled });
    // Célébrations désactivées : seulement le retour haptique
    if (!plan) {
      playHaptic("light");
      return null;
    }
    clearTimers();
    const id = ++lastId.current;
    const message = t.steps.stepDone;
    playHaptic(plan.haptic);
    AccessibilityInfo.announceForAccessibility(message);
    setActive({ id, category, message, plan, origin: null });
    timers.current.push(
      setTimeout(() => setActive((c) => (c?.id === id ? null : c)), CELEBRATION_MS)
    );
    return id;
  }, []);

  const dismiss = useCallback((id?: number) => {
    if (id !== undefined && id !== lastId.current) return; // déjà remplacée
    clearTimers();
    setActive(null);
  }, []);

  const isCelebrating = useCallback(() => activeRef.current !== null, []);
  const api = useMemo(
    () => ({ celebrate, celebrateStep, dismiss, isCelebrating }),
    [celebrate, celebrateStep, dismiss, isCelebrating]
  );
  const category = active ? CATEGORY_BY_KEY[active.category] : null;

  return (
    <CelebrationContext.Provider value={api}>
      {children}
      {active && category && (
        <View pointerEvents="none" style={styles.overlay}>
          {active.plan.confetti && active.plan.style && active.origin && (
            <Confetti
              key={`confetti-${active.id}`}
              origin={active.origin}
              celebrationStyle={active.plan.style}
            />
          )}
          <CelebrationMessage
            key={`message-${active.id}`}
            message={active.message}
            color={category.textColor}
            reduceMotion={reduceMotion}
          />
        </View>
      )}
    </CelebrationContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
