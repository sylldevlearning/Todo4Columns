import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Slot } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import QuadrantScreen from "../../app/quadrant/[category]";
import { getLastUndoAt, noteUndo } from "../reviewPrompt";
import React from "react";
import { AccessibilityInfo, Alert, AppState, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationProvider } from "../celebration/CelebrationProvider";
import MatrixGrid from "../components/MatrixGrid";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { STEP_FLASH_MS } from "../components/StepsEditor";
import TaskForm from "../components/TaskForm";
import { serializeTasks } from "../migrations";
import { ACTION_DONE } from "../notifications/setup";
import { useNotificationResponses } from "../notifications/useNotificationResponses";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TasksProvider, TasksState, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";
import { TaskStep } from "../types";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const NOW = new Date(2026, 9, 22, 10).getTime(); // jeudi 22 octobre 2026
const TODAY = "2026-10-22";

const step = (over: Partial<TaskStep> = {}): TaskStep => ({
  id: "s1",
  title: "Rédiger l'intro",
  done: false,
  doneAt: null,
  day: null,
  time: null,
  ...over,
});

let alert: jest.SpyInstance;
let now: jest.SpyInstance;
beforeEach(() => {
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  alert.mockClear();
  now = jest.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => now.mockRestore());

// Bouton « Terminer » de la dernière alerte
const pressAlertButton = async (label: string) => {
  const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === label)!.onPress?.());
};

describe("section « Étapes » de la fiche", () => {
  const renderForm = async (props: Partial<React.ComponentProps<typeof TaskForm>> = {}) => {
    const onSubmit = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <CelebrationProvider enabled>
          <TaskForm initialCategory="INU" settings={DEFAULT_SETTINGS} onSubmit={onSubmit} {...props} />
        </CelebrationProvider>
      </SafeAreaProvider>
    );
    return onSubmit;
  };
  const addStep = async (title: string) => {
    await fireEvent.changeText(screen.getByLabelText("Nouvelle étape"), title);
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter une étape" }));
  };

  it("ajouter, renommer, cocher, supprimer, avec un « i »", async () => {
    const onSubmit = await renderForm();
    expect(screen.getByLabelText("En savoir plus : Étapes")).toBeOnTheScreen();
    expect(screen.getByLabelText("En savoir plus : Répartir sur plusieurs jours")).toBeOnTheScreen();

    await addStep("Chercher les sources");
    await addStep("Faire le plan");
    await addStep("Brouillon");
    expect(screen.getByLabelText("Nouvelle étape").props.value).toBe("");

    await fireEvent.changeText(screen.getByLabelText("Étape 2"), "Faire le plan détaillé");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Chercher les sources »" }));
    expect(screen.getByRole("checkbox", { name: "Décocher « Chercher les sources »" })).toBeChecked();
    expect(alert).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Supprimer l'étape « Brouillon »" }));

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Exposé");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    expect(onSubmit.mock.calls[0][0].steps).toEqual([
      expect.objectContaining({ title: "Chercher les sources", done: true, doneAt: NOW, day: null }),
      expect.objectContaining({ title: "Faire le plan détaillé", done: false }),
    ]);
  });

  it("une étape cochée ailleurs pendant que la fiche est ouverte n'est pas décochée à l'enregistrement", async () => {
    const before = makeTask({
      id: "t",
      title: "Exposé",
      category: "INU",
      steps: [step({ id: "a", title: "Relire" }), step({ id: "b", title: "Envoyer" })],
    });
    const onSubmit = jest.fn();
    const ui = (task: typeof before) => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />
      </SafeAreaProvider>
    );
    const view = await render(ui(before));
    // Dans la fiche : « Envoyer » renommé (sa coche n'est pas touchée)
    await fireEvent.changeText(screen.getByLabelText("Étape 2"), "Envoyer le PDF");
    // Ailleurs (rappel « Fait ») : « Relire » et « Envoyer » cochées dans le magasin
    await view.rerender(
      ui({
        ...before,
        steps: [step({ id: "a", title: "Relire", done: true, doneAt: 5 }), step({ id: "b", title: "Envoyer", done: true, doneAt: 6 })],
      })
    );
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0].steps).toEqual([
      expect.objectContaining({ id: "a", title: "Relire", done: true, doneAt: 5 }),
      expect.objectContaining({ id: "b", title: "Envoyer le PDF", done: true, doneAt: 6 }),
    ]);
  });

  it("une coche changée dans la fiche l'emporte", async () => {
    const before = makeTask({ id: "t", title: "Exposé", steps: [step({ id: "a", title: "Relire", done: true, doneAt: 5 })] });
    const onSubmit = jest.fn();
    const ui = (task: typeof before) => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />
      </SafeAreaProvider>
    );
    const view = await render(ui(before));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Décocher « Relire »" }));
    await view.rerender(ui({ ...before }));
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0].steps[0]).toMatchObject({ done: false, doneAt: null });
  });

  it("notifications refusées : l'avertissement s'affiche pour une étape datée", async () => {
    await renderForm({ initialCategory: "NDNI", notificationsDenied: true });
    expect(screen.queryByText(/ce rappel ne s'affichera pas/)).toBeNull();
    await addStep("Trier");
    await fireEvent.press(screen.getByRole("button", { name: "Jour de « Trier » : Sans jour" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Demain" }));
    expect(screen.getByRole("link", { name: "Ouvrir les réglages du téléphone" })).toBeOnTheScreen();
  });

  it("un jour reporté ailleurs (« Reporter à demain ») est gardé ; un jour changé dans la fiche l'emporte", async () => {
    const before = makeTask({
      id: "t",
      title: "Exposé",
      category: "INU",
      steps: [
        step({ id: "a", title: "Relire", day: TODAY, time: "18:00" }),
        step({ id: "b", title: "Envoyer", day: TODAY }),
      ],
    });
    const onSubmit = jest.fn();
    const ui = (task: typeof before) => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <TaskForm task={task} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />
      </SafeAreaProvider>
    );
    const view = await render(ui(before));
    // Dans la fiche : « Relire » renommée (jour non touché), « Envoyer » sans jour
    await fireEvent.changeText(screen.getByLabelText("Étape 1"), "Relire tout");
    await fireEvent.press(screen.getByRole("button", { name: "Jour de « Envoyer » : Aujourd'hui" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Aucun" }));
    // Ailleurs : les deux reportées à demain
    await view.rerender(
      ui({
        ...before,
        steps: [
          step({ id: "a", title: "Relire", day: "2026-10-23", time: "18:00" }),
          step({ id: "b", title: "Envoyer", day: "2026-10-23" }),
        ],
      })
    );
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0].steps).toEqual([
      expect.objectContaining({ id: "a", title: "Relire tout", day: "2026-10-23", time: "18:00" }),
      expect.objectContaining({ id: "b", day: null, time: null }),
    ]);
  });

  it("choisir « Aucun » efface aussi l'heure de l'étape", async () => {
    const task = makeTask({
      id: "t",
      title: "Exposé",
      category: "INU",
      steps: [step({ id: "a", title: "Relire", day: "2026-10-23", time: "14:30" })],
    });
    const onSubmit = await renderForm({ task });
    await fireEvent.press(screen.getByRole("button", { name: "Jour de « Relire » : Demain" }));
    await fireEvent.press(screen.getByRole("radio", { name: "Aucun" }));
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSubmit.mock.calls[0][0].steps[0]).toMatchObject({ day: null, time: null });
  });

  it("« Nouvelle étape » : Entrée ajoute l'étape et garde le clavier (submitBehavior, pas blurOnSubmit)", async () => {
    await renderForm();
    const input = screen.getByLabelText("Nouvelle étape");
    expect(input.props.submitBehavior).toBe("submit");
    expect(input.props.blurOnSubmit).toBeUndefined();
    await fireEvent.changeText(input, "Relire");
    await fireEvent(input, "submitEditing");
    expect(screen.getByLabelText("Étape 1").props.value).toBe("Relire");
  });

  it("cocher dans la fiche : coche animée, ligne surlignée en vert, vibration ; pas de message caché", async () => {
    const impact = Haptics.impactAsync as jest.Mock;
    impact.mockClear();
    await renderForm();
    await addStep("Plan");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Plan »" }));
    const flash = screen.getByTestId("step-flash-0");
    expect(StyleSheet.flatten(flash.props.style)).toMatchObject({ opacity: expect.any(Number) });
    expect(impact).toHaveBeenCalledWith("light");
    expect(screen.queryByText("Étape faite !")).toBeNull();
    // Le surlignage disparaît de lui-même
    await waitFor(() => expect(screen.queryByTestId("step-flash-0")).toBeNull(), { timeout: STEP_FLASH_MS + 1000 });

    // Décocher : ni surlignage ni vibration
    impact.mockClear();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Décocher « Plan »" }));
    expect(screen.queryByTestId("step-flash-0")).toBeNull();
    expect(impact).not.toHaveBeenCalled();
  });

  it("« Réduire les animations » : surlignage sans fondu, vibration gardée", async () => {
    const reduce = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const impact = Haptics.impactAsync as jest.Mock;
    impact.mockClear();
    await renderForm();
    await act(async () => {});
    await addStep("Plan");
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Plan »" }));
    // Pas d'opacité animée : le vert s'affiche tel quel, puis disparaît
    expect(StyleSheet.flatten(screen.getByTestId("step-flash-0").props.style).opacity).toBeUndefined();
    expect(impact).toHaveBeenCalledWith("light");
    reduce.mockResolvedValue(false);
  });

  it("réordonner avec « Monter » / « Descendre » de la poignée (lecteur d'écran)", async () => {
    const onSubmit = await renderForm();
    for (const title of ["A", "B", "C"]) await addStep(title);
    await fireEvent(screen.getByTestId("step-handle-0"), "accessibilityAction", { nativeEvent: { actionName: "moveDown" } });
    await fireEvent(screen.getByTestId("step-handle-2"), "accessibilityAction", { nativeEvent: { actionName: "moveUp" } });

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Ordre");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    expect(onSubmit.mock.calls[0][0].steps.map((s: TaskStep) => s.title)).toEqual(["B", "C", "A"]);
  });

  it("poignée accessible : élément focalisable, libellé, consigne et actions ; le titre n'en porte pas", async () => {
    await renderForm();
    for (const title of ["A", "B"]) await addStep(title);
    const handle = screen.getByRole("button", { name: "Déplacer « A »" });
    expect(handle.props.testID).toBe("step-handle-0");
    expect(handle.props.accessible).toBe(true);
    expect(handle.props.accessibilityHint).toBe("Appui long sur la poignée puis glisser pour changer l'ordre");
    expect(handle.props.accessibilityActions).toEqual([{ name: "moveDown", label: "Descendre" }]);
    expect(screen.getByRole("button", { name: "Déplacer « B »" }).props.accessibilityActions).toEqual([
      { name: "moveUp", label: "Monter" },
    ]);
    // Zone tactile de 44 px
    expect(StyleSheet.flatten(handle.props.style)).toMatchObject({ width: 44, height: 44 });
    expect(screen.getByLabelText("Étape 1").props.accessibilityActions).toBeUndefined();
  });

  it("glisser depuis la poignée : place au lâcher calculée sur les positions mesurées", async () => {
    const onSubmit = await renderForm();
    for (const title of ["A", "B", "C", "D"]) await addStep(title);
    // Positions mesurées : « B » a son jour ouvert (ligne haute)
    const rows = [
      { y: 0, height: 52 },
      { y: 58, height: 180 },
      { y: 244, height: 52 },
      { y: 302, height: 52 },
    ];
    for (const [i, layout] of rows.entries()) {
      await fireEvent(screen.getByTestId(`step-${i}`), "layout", { nativeEvent: { layout: { x: 0, width: 300, ...layout } } });
    }
    // « A » glissée de 250 px : son milieu (26 + 250) dépasse ceux de « B » (148) et « C » (270)
    await act(async () =>
      fireGestureHandler(getByGestureTestId("step-drag-0"), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 250 },
        { state: State.END, translationY: 250 },
      ])
    );
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Ordre");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    // Avec une hauteur fixe de 52 px, « A » serait partie 5 places plus bas (au bout)
    expect(onSubmit.mock.calls[0][0].steps.map((s: TaskStep) => s.title)).toEqual(["B", "C", "A", "D"]);
  });

  it("jour de l'étape : Aucun / Aujourd'hui / Demain / Date, puis l'heure du rappel", async () => {
    const onSubmit = await renderForm();
    await addStep("Relire");
    await fireEvent.press(screen.getByRole("button", { name: "Jour de « Relire » : Sans jour" }));
    expect(screen.getByRole("radio", { name: "Aucun" })).toBeSelected();
    expect(screen.getByRole("radio", { name: "Date" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("radio", { name: "Demain" }));
    expect(screen.getByRole("button", { name: "Jour de « Relire » : Demain" })).toBeOnTheScreen();
    expect(screen.getByText("Heure du rappel")).toBeOnTheScreen();
    // Demain : rappel à 9:00, pas de ligne « aujourd'hui »
    expect(screen.queryByText(/Rappel aujourd'hui/)).toBeNull();
    // Aujourd'hui à 10:00 : 9:00 est passé, rappel à l'heure pleine suivante
    await fireEvent.press(screen.getByRole("radio", { name: "Aujourd'hui" }));
    expect(screen.getByText("Rappel aujourd'hui à 11:00")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Relecture");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    expect(onSubmit.mock.calls[0][0].steps[0]).toMatchObject({ day: TODAY, time: "11:00" });
  });

  it("« Répartir sur plusieurs jours » : réglages, aperçu, puis création", async () => {
    const onSubmit = await renderForm();
    await fireEvent.press(screen.getByRole("button", { name: "Répartir sur plusieurs jours" }));
    const sheet = within(screen.getByTestId("split-sessions"));
    expect(sheet.getByText("5 séances")).toBeOnTheScreen();

    await fireEvent.press(sheet.getByRole("button", { name: "Une séance de moins" }));
    await fireEvent.press(sheet.getByRole("button", { name: "Une séance de moins" }));
    await fireEvent.press(sheet.getByRole("radio", { name: "30 min" }));
    await fireEvent(sheet.getByLabelText("Jours de semaine seulement"), "valueChange", true);
    // Aperçu : vendredi, puis lundi et mardi (week-end sauté)
    expect(sheet.getByText("Séance 1/3 · 30 min")).toBeOnTheScreen();
    expect(sheet.getByText("Séance 3/3 · 30 min")).toBeOnTheScreen();
    // Pastille « Demain » et premier jour de l'aperçu, puis lundi 26
    expect(sheet.getAllByText("Demain")).toHaveLength(2);
    expect(sheet.getByText(/lun. 26 oct./)).toBeOnTheScreen();
    expect(sheet.queryByText(/sam\./)).toBeNull();

    await fireEvent.press(sheet.getByRole("button", { name: "Créer les 3 séances" }));
    expect(screen.queryByTestId("split-sessions")).toBeNull();

    await fireEvent.changeText(screen.getByLabelText("Titre"), "Réviser");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    expect(onSubmit.mock.calls[0][0].steps.map((s: TaskStep) => [s.title, s.day])).toEqual([
      ["Séance 1/3 · 30 min", "2026-10-23"],
      ["Séance 2/3 · 30 min", "2026-10-26"],
      ["Séance 3/3 · 30 min", "2026-10-27"],
    ]);
  });

  it("répartir à partir d'aujourd'hui à 10:00 : la séance du jour a son rappel à 11:00", async () => {
    const onSubmit = await renderForm();
    await fireEvent.press(screen.getByRole("button", { name: "Répartir sur plusieurs jours" }));
    const sheet = within(screen.getByTestId("split-sessions"));
    await fireEvent.press(sheet.getByRole("radio", { name: "Aujourd'hui" }));
    expect(sheet.getByText("Aujourd'hui, 11:00")).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole("button", { name: "Créer les 5 séances" }));
    expect(screen.getByText("Rappel aujourd'hui à 11:00")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Réviser");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    const steps = onSubmit.mock.calls[0][0].steps;
    expect(steps[0]).toMatchObject({ day: TODAY, time: "11:00" });
    expect(steps[1]).toMatchObject({ day: "2026-10-23", time: null });
  });

  it("« Annuler » ne crée aucune séance", async () => {
    const onSubmit = await renderForm();
    await fireEvent.press(screen.getByRole("button", { name: "Répartir sur plusieurs jours" }));
    await fireEvent.press(within(screen.getByTestId("split-sessions")).getByRole("button", { name: "Annuler" }));
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Rien");
    await fireEvent.press(screen.getByRole("button", { name: "Ajouter à « Planifier »" }));
    expect(onSubmit.mock.calls[0][0].steps).toEqual([]);
  });

  it("dernière étape cochée : « Terminer la tâche ? », et « Terminer » termine la tâche", async () => {
    const task = makeTask({
      id: "t",
      title: "Exposé",
      category: "INU",
      steps: [step({ id: "a", done: true, doneAt: 1 }), step({ id: "b", title: "Répéter" })],
    });
    const onComplete = jest.fn();
    await renderForm({ task, onComplete });
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Répéter »" }));
    expect(alert).toHaveBeenCalledWith("Terminer la tâche ?", "Toutes les étapes sont faites.", expect.any(Array), expect.any(Object));

    await pressAlertButton("Terminer");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].steps.every((s: TaskStep) => s.done)).toBe(true);
  });

  it("« Pas encore » : rien n'est terminé ; décocher ne propose rien", async () => {
    const task = makeTask({ id: "t", title: "Exposé", steps: [step({ id: "b", title: "Répéter" })] });
    const onComplete = jest.fn();
    await renderForm({ task, onComplete });
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Répéter »" }));
    await pressAlertButton("Pas encore");
    expect(onComplete).not.toHaveBeenCalled();
    alert.mockClear();
    await fireEvent.press(screen.getByRole("checkbox", { name: "Décocher « Répéter »" }));
    expect(alert).not.toHaveBeenCalled();
  });
});

describe("carte et grille", () => {
  let state: TasksState;
  const Grab = () => {
    state = useTasksSelector((s) => s);
    return null;
  };
  // Écran du quadrant « Planifier », comme dans l'app (bandeau « Annuler » compris)
  const Layout = () => (
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <CelebrationProvider enabled>
          <Slot />
          <Grab />
        </CelebrationProvider>
      </TasksProvider>
    </SafeAreaProvider>
  );
  const seed = async (steps: TaskStep[]) => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([makeTask({ id: "t", title: "Exposé", category: "INU", steps })]));
    await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
    await renderRouter({ _layout: Layout, "quadrant/[category]": QuadrantScreen }, { initialUrl: "/quadrant/INU" });
    await screen.findByText("Exposé");
  };

  it("progression « 1/3 », étape du jour, étape en retard", async () => {
    await seed([
      step({ id: "a", done: true, doneAt: 1, day: "2026-10-20" }),
      step({ id: "b", title: "Relire", day: "2026-10-21" }),
      step({ id: "c", title: "Envoyer", day: TODAY }),
    ]);
    expect(screen.getByText("1/3")).toBeOnTheScreen();
    expect(screen.getByLabelText("1 étape faite sur 3")).toBeOnTheScreen();
    expect(screen.getByText("Aujourd'hui : Envoyer")).toBeOnTheScreen();
    expect(screen.getByText("En retard : Relire")).toBeOnTheScreen();
  });

  it("cocher une étape depuis la carte : célébration discrète et « Annuler » (enregistré pour la demande d'avis)", async () => {
    await seed([step({ id: "b", title: "Relire", day: TODAY }), step({ id: "c", title: "Envoyer" })]);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Relire »" }));
    expect(state.tasks[0].steps![0].done).toBe(true);
    expect(screen.getByText("Étape faite !")).toBeOnTheScreen();
    expect(screen.getByText("Étape cochée")).toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();

    noteUndo(0);
    await fireEvent.press(screen.getByRole("button", { name: "Annuler" }));
    expect(state.tasks[0].steps![0].done).toBe(false);
    expect(getLastUndoAt()).toBe(NOW);
  });

  it("dernière étape depuis la carte : « Terminer » termine la tâche, avec célébration complète et « Annuler »", async () => {
    await seed([step({ id: "a", done: true, doneAt: 1 }), step({ id: "c", title: "Envoyer", day: TODAY })]);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Cocher « Envoyer »" }));
    expect(state.tasks[0].steps![1].done).toBe(true);
    expect(alert).toHaveBeenCalledWith("Terminer la tâche ?", "Toutes les étapes sont faites.", expect.any(Array), expect.any(Object));

    await pressAlertButton("Terminer");
    await waitFor(() => expect(state.tasks[0].isDone).toBe(true));
    expect(state.completions).toHaveLength(1);
    expect(screen.getByText("Tâche terminée")).toBeOnTheScreen();
    expect(screen.queryByText("Étape faite !")).toBeNull(); // remplacée par la célébration complète

    noteUndo(0);
    await fireEvent.press(screen.getByRole("button", { name: "Annuler" }));
    expect(state.tasks[0].isDone).toBe(false);
    expect(getLastUndoAt()).toBe(NOW);
  });

  it("grille : progression discrète à côté du titre", async () => {
    await render(
      <MatrixGrid
        tasks={[makeTask({ id: "t", title: "Exposé", category: "INU", steps: [step({ done: true, doneAt: 1 }), step({ id: "b" })] })]}
        onOpenQuadrant={() => {}}
      />
    );
    expect(screen.getByText("1/2")).toBeOnTheScreen();
    expect(screen.getByLabelText("1 étape faite sur 2")).toBeOnTheScreen();
  });

  it("sans étapes : rien de plus sur la carte", async () => {
    await seed([]);
    expect(screen.queryByText(/\d\/\d/)).toBeNull();
  });
});

describe("« Fait » dans le rappel d'une étape, app à l'écran", () => {
  it("coche l'étape et prévient l'app (célébration, proposition de fin)", async () => {
    Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
    const task = makeTask({ id: "t", steps: [step({ id: "a" })] });
    const completeStep = jest.fn();
    const onStepCompletedInApp = jest.fn();
    await renderHook(() =>
      useNotificationResponses({
        isLoaded: true,
        tasks: [task],
        completeTask: jest.fn(),
        snoozeTask: jest.fn(),
        openQuadrant: jest.fn(),
        completeStep,
        onStepCompletedInApp,
      })
    );
    await act(async () => {});
    await act(async () =>
      (Notifications as unknown as { __emitResponse: (r: unknown) => void }).__emitResponse({
        actionIdentifier: ACTION_DONE,
        notification: {
          date: NOW,
          request: { identifier: "n1", content: { data: { taskId: "t", stepId: "a", type: "step" } } },
        },
      })
    );
    expect(completeStep).toHaveBeenCalledWith("t", "a");
    expect(onStepCompletedInApp).toHaveBeenCalledWith(task, "a");
  });
});
