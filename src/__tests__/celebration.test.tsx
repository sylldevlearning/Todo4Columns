import { act, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import React from "react";
import { AccessibilityInfo } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationProvider, useCelebration } from "../celebration/CelebrationProvider";
import {
  CELEBRATION_MS,
  CELEBRATION_STYLES,
  makeParticles,
  particleOffset,
  planCelebration,
} from "../celebration/plan";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { fr } from "../i18n/fr";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};

describe("planCelebration", () => {
  it("ne joue rien quand l'option est désactivée", () => {
    expect(planCelebration("INU", { enabled: false, reduceMotion: false })).toBeNull();
  });

  it("sans confettis quand le téléphone réduit les animations, mais avec le message", () => {
    const plan = planCelebration("INU", { enabled: true, reduceMotion: true });
    expect(plan).not.toBeNull();
    expect(plan!.confetti).toBe(false);
  });

  it("intensité : Planifier > Faire > Déléguer > Si j'ai le temps", () => {
    const counts = (["INU", "UI", "UDI", "NDNI"] as const).map((c) => CELEBRATION_STYLES[c].count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(new Set(counts).size).toBe(4);
    expect(CELEBRATION_STYLES.NDNI.count).toBeLessThanOrEqual(12);
  });

  it("haptique success pour Planifier et Faire, léger pour Déléguer et Si j'ai le temps", () => {
    expect(
      (["INU", "UI", "UDI", "NDNI"] as const).map((c) => CELEBRATION_STYLES[c].haptic)
    ).toEqual(["success", "success", "light", "light"]);
  });

  it("couleurs du quadrant, et plusieurs couleurs pour Planifier", () => {
    for (const key of ["UI", "INU", "UDI", "NDNI"] as const) {
      expect(CELEBRATION_STYLES[key].colors).toContain(CATEGORY_BY_KEY[key].color);
    }
    expect(CELEBRATION_STYLES.INU.colors).toEqual(
      expect.arrayContaining([CATEGORY_BY_KEY.UI.color, CATEGORY_BY_KEY.UDI.color])
    );
  });

  it("projette les confettis vers le haut puis les fait retomber", () => {
    const particles = makeParticles(CELEBRATION_STYLES.UI, () => 0.5);
    expect(particles).toHaveLength(CELEBRATION_STYLES.UI.count);
    const p = particles[0];
    expect(particleOffset(p, 0)).toEqual({ x: 0, y: 0 });
    expect(particleOffset(p, 0.2).y).toBeLessThan(0); // monte
    expect(particleOffset(p, 1.7).y).toBeGreaterThan(0); // retombe sous la tâche
  });
});

describe("CelebrationProvider", () => {
  let api: ReturnType<typeof useCelebration>;
  function Grab() {
    api = useCelebration();
    return null;
  }

  const setup = async (enabled = true) => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CelebrationProvider enabled={enabled}>
          <Grab />
        </CelebrationProvider>
      </SafeAreaProvider>
    );
    // Laisse useReduceMotion lire le réglage du téléphone
    await act(async () => {});
  };

  const message = () => screen.queryByTestId("celebration-message");
  const confetti = () => screen.queryByTestId("celebration-confetti");
  const shownText = () => {
    const all = Object.values(fr.celebrations).flat();
    return all.find((m) => screen.queryByText(m) !== null);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  });

  it("affiche confettis et message, puis disparaît au bout de ~2,6 s", async () => {
    await setup();
    await act(() => {
      api.celebrate("UI");
    });

    expect(message()).toBeOnTheScreen();
    expect(fr.celebrations.UI).toContain(shownText());
    await waitFor(() => expect(confetti()).toBeOnTheScreen());
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");

    await waitFor(() => expect(message()).toBeNull(), { timeout: CELEBRATION_MS + 1000 });
    expect(confetti()).toBeNull();
  });

  it("fait partir l'explosion de la tâche, avec un haptique léger pour Déléguer", async () => {
    await setup();
    const anchor = { measureInWindow: jest.fn((cb) => cb(16, 300, 358, 64)) };
    await act(() => {
      api.celebrate("UDI", anchor);
    });

    expect(anchor.measureInWindow).toHaveBeenCalled();
    expect(confetti()).toBeOnTheScreen(); // position connue : pas d'attente
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it("réduction des animations : le message seul, sans confettis", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await setup();
    await act(() => {
      api.celebrate("INU", { measureInWindow: (cb) => cb(0, 300, 390, 64) });
    });

    expect(message()).toBeOnTheScreen();
    expect(fr.celebrations.INU).toContain(shownText());
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(confetti()).toBeNull();
  });

  it("option désactivée : ni confettis, ni message, ni haptique", async () => {
    await setup(false);
    let id: number | null = 0;
    await act(() => {
      id = api.celebrate("INU");
    });

    expect(id).toBeNull();
    expect(message()).toBeNull();
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(confetti()).toBeNull();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it("dismiss fait disparaître la célébration, mais pas une plus récente", async () => {
    await setup();
    let first: number | null = null;
    await act(() => {
      first = api.celebrate("NDNI");
    });
    await act(() => api.dismiss(first!));
    expect(message()).toBeNull();

    let second: number | null = null;
    await act(() => {
      second = api.celebrate("UI");
    });
    await act(() => api.dismiss(first!)); // ancienne : sans effet
    expect(message()).toBeOnTheScreen();
    await act(() => api.dismiss(second!));
    expect(message()).toBeNull();
  });

  it("ne bloque pas les touches", async () => {
    await setup();
    await act(() => {
      api.celebrate("UI");
    });
    let node = screen.getByTestId("celebration-message").parent;
    // Un ancêtre en pointerEvents="none" laisse passer les touches vers l'app
    let passThrough = false;
    while (node) {
      if (node.props?.pointerEvents === "none") passThrough = true;
      node = node.parent;
    }
    expect(passThrough).toBe(true);
  });
});
