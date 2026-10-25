import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as StoreReview from "expo-store-review";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ReviewScreen from "../../app/review";
import { CelebrationProvider, useCelebration } from "../celebration/CelebrationProvider";
import { Completion, saveLog } from "../completionLog";
import ReviewPrompter from "../components/ReviewPrompter";
import UndoBanner from "../components/UndoBanner";
import {
  canAskForReview,
  estimateFirstUse,
  noteUndo,
  requestReviewPrompt,
  REVIEW_DELAY_MS,
} from "../reviewPrompt";
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings, Settings } from "../settings";
import { serializeTasks } from "../migrations";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, useTaskActions } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 22, 10).getTime();
const requestReview = StoreReview.requestReview as jest.Mock;
const isAvailable = StoreReview.isAvailableAsync as jest.Mock;

describe("conditions de la demande d'avis", () => {
  const dates = { firstUseAt: NOW - 10 * DAY, lastUndoAt: null };

  it("jamais pendant les 3 premiers jours", () => {
    expect(canAskForReview({ ...dates, firstUseAt: NOW - 2 * DAY }, NOW)).toBe(false);
    expect(canAskForReview({ ...dates, firstUseAt: NOW - 3 * DAY + 1 }, NOW)).toBe(false);
    expect(canAskForReview({ ...dates, firstUseAt: NOW - 3 * DAY }, NOW)).toBe(true);
  });

  it("au plus une fois tous les 90 jours", () => {
    expect(canAskForReview({ ...dates, reviewAskedAt: NOW - 89 * DAY }, NOW)).toBe(false);
    expect(canAskForReview({ ...dates, reviewAskedAt: NOW - 90 * DAY }, NOW)).toBe(true);
  });

  it("jamais juste après un « Annuler »", () => {
    expect(canAskForReview({ ...dates, lastUndoAt: NOW - 5000 }, NOW)).toBe(false);
    expect(canAskForReview({ ...dates, lastUndoAt: NOW - 30 * 1000 }, NOW)).toBe(true);
  });

  it("première utilisation inconnue : la plus ancienne tâche ou fin de tâche", () => {
    const tasks = [makeTask({ createdAt: NOW - 5 * DAY }), makeTask({ id: "b", createdAt: NOW - DAY })];
    expect(estimateFirstUse(tasks, [], NOW)).toBe(NOW - 5 * DAY);
    expect(estimateFirstUse(tasks, [{ date: NOW - 8 * DAY, category: "UI" }], NOW)).toBe(NOW - 8 * DAY);
    expect(estimateFirstUse([], [], NOW)).toBe(NOW);
  });

  it("dates mémorisées dans les réglages : champs optionnels, réglages existants inchangés", async () => {
    const before = JSON.stringify({ schemaVersion: 1, settings: { ...DEFAULT_SETTINGS, doNagInterval: 30 } });
    expect(parseSettings(before)).toEqual({ ...DEFAULT_SETTINGS, doNagInterval: 30 });
    expect(parseSettings(before)).not.toHaveProperty("firstUseAt");
    const invalid = JSON.stringify({ schemaVersion: 1, settings: { firstUseAt: "hier", reviewAskedAt: -1 } });
    expect(parseSettings(invalid)).not.toHaveProperty("reviewAskedAt");

    await saveSettings({ ...DEFAULT_SETTINGS, firstUseAt: NOW - DAY, reviewAskedAt: NOW });
    expect(await loadSettings()).toMatchObject({ firstUseAt: NOW - DAY, reviewAskedAt: NOW });
  });
});

describe("demande d'avis dans l'app", () => {
  let actions: TaskActions;
  let celebration: ReturnType<typeof useCelebration>;
  const Grab = () => {
    actions = useTaskActions();
    celebration = useCelebration();
    return null;
  };

  // 9 tâches déjà terminées, une tâche ouverte ; première tâche créée il y a 10 jours
  const seed = async ({ createdDaysAgo = 10, done = 9, settings = {} as Partial<Settings> } = {}) => {
    const log: Completion[] = Array.from({ length: done }, (_, i) => ({ date: NOW - DAY + i, category: "UI" }));
    await AsyncStorage.setItem(
      STORAGE_KEY,
      serializeTasks([makeTask({ id: "open", createdAt: NOW - createdDaysAgo * DAY, updatedAt: NOW })])
    );
    await saveLog(log);
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false, ...settings });
  };

  const launch = async (children?: React.ReactNode) => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <TasksProvider>
          <CelebrationProvider enabled>
            <ReviewPrompter />
            <Grab />
            {children}
          </CelebrationProvider>
        </TasksProvider>
      </SafeAreaProvider>
    );
    await act(() => jest.advanceTimersByTimeAsync(0));
    await act(() => jest.advanceTimersByTimeAsync(0));
  };

  // Par pas de 100 ms : React rend entre deux pas (fin d'une célébration…)
  const wait = async (ms: number) => {
    for (let left = ms; left > 0; left -= 100) {
      await act(() => jest.advanceTimersByTimeAsync(Math.min(100, left)));
    }
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW });
    await AsyncStorage.clear();
    requestReview.mockClear();
    isAvailable.mockClear();
    noteUndo(0);
  });
  afterEach(() => jest.useRealTimers());

  it("10e tâche terminée : fenêtre d'avis une fois le bandeau « Annuler » parti, date mémorisée", async () => {
    await seed();
    await launch();
    await act(() => actions.toggleDone("open"));
    await wait(REVIEW_DELAY_MS - 100);
    expect(requestReview).not.toHaveBeenCalled();

    await wait(200);
    expect(requestReview).toHaveBeenCalledTimes(1);
    await wait(1000);
    expect(await loadSettings()).toMatchObject({ reviewAskedAt: NOW + REVIEW_DELAY_MS, firstUseAt: NOW - 10 * DAY });
  });

  it("pas avant la 10e tâche terminée", async () => {
    await seed({ done: 8 });
    await launch();
    await act(() => actions.toggleDone("open"));
    await wait(REVIEW_DELAY_MS * 2);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("jamais pendant les 3 premiers jours : la première utilisation est retenue pour plus tard", async () => {
    await seed({ createdDaysAgo: 1 });
    await launch();
    await act(() => actions.toggleDone("open"));
    await wait(REVIEW_DELAY_MS * 2);
    expect(requestReview).not.toHaveBeenCalled();
    expect((await loadSettings()).firstUseAt).toBe(NOW - DAY);
  });

  it("au plus une fois tous les 90 jours", async () => {
    await seed({ settings: { firstUseAt: NOW - 200 * DAY, reviewAskedAt: NOW - 60 * DAY } });
    await launch();
    await act(() => actions.toggleDone("open"));
    await wait(REVIEW_DELAY_MS * 2);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("jamais juste après un « Annuler »", async () => {
    await seed();
    await launch(<UndoBanner message="Tâche terminée" onUndo={() => actions.toggleDone("open")} />);
    await act(() => actions.toggleDone("open"));
    await fireEvent.press(screen.getByRole("button", { name: "Annuler" }));
    // Terminée à nouveau aussitôt : toujours pas
    await act(() => actions.toggleDone("open"));
    await wait(REVIEW_DELAY_MS * 2);
    expect(requestReview).not.toHaveBeenCalled();
  });

  it("jamais par-dessus une célébration en cours : attend qu'elle soit finie", async () => {
    await seed({ done: 0 });
    await launch();
    await act(async () => requestReviewPrompt("weeklyReview"));
    await wait(REVIEW_DELAY_MS - 500);
    await act(async () => {
      celebration.celebrate("UI");
    });
    await wait(1000);
    expect(celebration.isCelebrating()).toBe(true);
    expect(requestReview).not.toHaveBeenCalled();

    await wait(3000);
    expect(celebration.isCelebrating()).toBe(false);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it("fin d'une revue de la semaine : fenêtre d'avis après la célébration", async () => {
    await seed({ done: 0 });
    await launch(<ReviewScreen />);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByRole("button", { name: "Passer" }));
    expect(screen.getByText("Revue terminée !")).toBeOnTheScreen();
    expect(celebration.isCelebrating()).toBe(true);
    await wait(REVIEW_DELAY_MS + 200);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it("fenêtre d'avis indisponible : rien n'est demandé", async () => {
    isAvailable.mockResolvedValueOnce(false);
    await seed();
    await launch();
    await act(() => actions.toggleDone("open"));
    await wait(REVIEW_DELAY_MS * 2);
    expect(requestReview).not.toHaveBeenCalled();
    expect((await loadSettings()).reviewAskedAt).toBeUndefined();
  });
});
