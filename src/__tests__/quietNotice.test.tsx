import AsyncStorage from "@react-native-async-storage/async-storage";
import { render } from "@testing-library/react-native";
import { router, Slot, useLocalSearchParams } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import React from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TaskSheet from "../../app/task";
import TaskForm from "../components/TaskForm";
import { en } from "../i18n/en";
import { quietNoticeFor } from "../quietNotice";
import { EMPTY_REMINDER_FIELDS } from "../reminders";
import { DEFAULT_SETTINGS, saveSettings, Settings } from "../settings";
import { TaskActions, TasksProvider, useTaskActions } from "../store/TasksContext";

const at = (h: number, m = 0, day = 22) => new Date(2026, 9, day, h, m).getTime();
const QUIET: Settings = { ...DEFAULT_SETTINGS, quietHoursEnabled: true }; // 22:00 → 08:00

describe("rappel qui tombe dans la plage silencieuse", () => {
  const nag = (minutes: number) => ({ ...EMPTY_REMINDER_FIELDS, category: "UI" as const, nagInterval: minutes });

  it("heure d'arrivée : la fin de la plage", () => {
    // Relance 2 h après 21 h : 23 h, dans la plage → 08:00
    expect(quietNoticeFor(nag(120), QUIET, at(21))).toEqual({ start: "22:00", end: "08:00", arrival: "08:00" });
    // Autres horaires
    expect(
      quietNoticeFor(nag(30), { ...QUIET, quietHoursStart: "23:00", quietHoursEnd: "07:30" }, at(23, 15))
    ).toEqual({ start: "23:00", end: "07:30", arrival: "07:30" });
  });

  it("« Planifier » : rappel avant l'échéance dans la plage", () => {
    const planned = {
      ...EMPTY_REMINDER_FIELDS,
      category: "INU" as const,
      dueAt: at(23, 30, 23),
      reminderOffset: 60, // 22:30, dans la plage
    };
    expect(quietNoticeFor(planned, QUIET, at(10))?.arrival).toBe("08:00");
  });

  it("rien si le rappel est hors de la plage, ou si la plage est désactivée", () => {
    expect(quietNoticeFor(nag(30), QUIET, at(10))).toBeNull();
    expect(quietNoticeFor(nag(120), DEFAULT_SETTINGS, at(21))).toBeNull();
    expect(quietNoticeFor({ ...EMPTY_REMINDER_FIELDS, category: "NDNI" }, QUIET, at(21))).toBeNull();
  });

  it("texte anglais", () => {
    expect(en.quietNotice.message("22:00", "08:00", "08:00")).toBe(
      "This reminder falls in your quiet hours (22:00–08:00): it will arrive at 08:00."
    );
  });
});

describe("ligne d'information dans la fiche", () => {
  let now: jest.SpyInstance;
  beforeEach(() => {
    now = jest.spyOn(Date, "now").mockReturnValue(at(21));
  });
  afterEach(() => now.mockRestore());

  it("affichée sans bloquer, avec « Modifier la plage » et « Désactiver la plage »", async () => {
    const onEdit = jest.fn();
    const onDisable = jest.fn();
    const onSubmit = jest.fn();
    await render(
      <TaskForm
        initialCategory="UI"
        settings={QUIET}
        onSubmit={onSubmit}
        onEditQuietHours={onEdit}
        onDisableQuietHours={onDisable}
      />
    );
    expect(
      screen.getByText("Ce rappel tombe dans ta plage silencieuse (22:00–08:00) : il arrivera à 08:00.")
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Modifier la plage" }));
    expect(onEdit).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Désactiver la plage" }));
    expect(onDisable).toHaveBeenCalled();

    // Sans bloquer : la tâche s'enregistre
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Appeler");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Faire »" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("absente quand la plage est désactivée", async () => {
    await render(<TaskForm initialCategory="UI" settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    expect(screen.queryByText(/plage silencieuse/)).toBeNull();
  });

  it("dans l'app : « Désactiver la plage » la fait disparaître, « Modifier la plage » ouvre les Réglages", async () => {
    await AsyncStorage.clear();
    await saveSettings({ ...QUIET, onboardingDone: true, weeklyReview: false });
    let actions: TaskActions;
    const Grab = () => {
      actions = useTaskActions();
      return null;
    };
    const Layout = () => (
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <TasksProvider>
          <Slot />
          <Grab />
        </TasksProvider>
      </SafeAreaProvider>
    );
    const Empty = () => null;
    // Réglages : affiche la section demandée
    const Settings = () => {
      const { section } = useLocalSearchParams<{ section?: string }>();
      return <Text>{`Réglages, section ${section}`}</Text>;
    };
    await renderRouter({ _layout: Layout, index: Empty, task: TaskSheet, settings: Settings }, { initialUrl: "/" });
    await act(async () => {});
    await act(() => router.push("/task?category=UI"));
    expect(screen.getByText(/il arrivera à 08:00/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Modifier la plage" }));
    expect(await screen.findByText("Réglages, section quietHours")).toBeOnTheScreen();
    await act(() => router.back());

    await fireEvent.press(screen.getByRole("button", { name: "Désactiver la plage" }));
    expect(actions!.getSettings().quietHoursEnabled).toBe(false);
    expect(screen.queryByText(/il arrivera à 08:00/)).toBeNull();
  });
});
