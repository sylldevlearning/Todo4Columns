import { fireEvent, render, screen, within } from "@testing-library/react-native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SplitSessions from "../components/SplitSessions";
import { addDays, dayKey } from "../dates";
import { METRICS } from "../testing/metrics";

const renderSheet = async () => {
  const onCreate = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SplitSessions color="#5B9BFF" onColor="#000" textColor="#8BB8FF" onCancel={() => {}} onCreate={onCreate} />
    </SafeAreaProvider>
  );
  return { onCreate, sheet: () => within(screen.getByTestId("split-sessions")) };
};

describe("répartition : trois modes", () => {
  it("« Jours d'affilée » par défaut, comme avant", async () => {
    const { sheet } = await renderSheet();
    expect(sheet().getByRole("radio", { name: "Jours d'affilée" })).toBeSelected();
    expect(sheet().getByText("5 séances")).toBeOnTheScreen();
    expect(sheet().getByLabelText("Jours de semaine seulement")).toBeOnTheScreen();
    expect(sheet().getByRole("button", { name: "Créer les 5 séances" })).toBeOnTheScreen();
  });

  it("« Certains jours de la semaine » : lun/mer/ven proposés, le nombre de séances suit les jours choisis", async () => {
    const { sheet, onCreate } = await renderSheet();
    await fireEvent.press(sheet().getByRole("radio", { name: "Certains jours de la semaine" }));
    // Semaine du lundi en français
    const order = sheet()
      .getAllByTestId(/^week-day-/)
      .map((e) => e.props.testID);
    expect(order).toEqual(["week-day-1", "week-day-2", "week-day-3", "week-day-4", "week-day-5", "week-day-6", "week-day-0"]);
    expect(sheet().getByTestId("week-day-1").props.accessibilityState).toMatchObject({ checked: true });
    expect(sheet().getByTestId("week-day-2").props.accessibilityState).toMatchObject({ checked: false });
    expect(sheet().getByText("3 séances")).toBeOnTheScreen();
    // Pas de « jours de semaine seulement » dans ce mode
    expect(sheet().queryByLabelText("Jours de semaine seulement")).toBeNull();

    await fireEvent.press(sheet().getByTestId("week-day-2"));
    expect(sheet().getByText("4 séances")).toBeOnTheScreen();
    await fireEvent.press(sheet().getByRole("button", { name: "Créer les 4 séances" }));
    const sessions = onCreate.mock.calls[0][0];
    expect(sessions).toHaveLength(4);
    // Toutes les séances tombent un lundi, mardi, mercredi ou vendredi
    for (const s of sessions) expect([1, 2, 3, 5]).toContain(new Date(`${s.day}T12:00:00`).getDay());
  });

  it("le dernier jour de la semaine choisi ne peut pas être retiré", async () => {
    const { sheet } = await renderSheet();
    await fireEvent.press(sheet().getByRole("radio", { name: "Certains jours de la semaine" }));
    await fireEvent.press(sheet().getByTestId("week-day-1"));
    await fireEvent.press(sheet().getByTestId("week-day-3"));
    await fireEvent.press(sheet().getByTestId("week-day-5"));
    expect(sheet().getByTestId("week-day-5").props.accessibilityState).toMatchObject({ checked: true });
  });

  it("« Dates précises » : sélection multiple sur le mini-calendrier, aperçu, jours passés impossibles", async () => {
    const { sheet, onCreate } = await renderSheet();
    await fireEvent.press(sheet().getByRole("radio", { name: "Dates précises" }));
    expect(sheet().getByTestId("mini-calendar")).toBeOnTheScreen();
    expect(sheet().getByText("Choisis au moins 2 jours.")).toBeOnTheScreen();
    expect(sheet().getByRole("button", { name: "Créer les 2 séances" })).toBeDisabled();
    // Pas de nombre de séances ni de « à partir de » : les dates choisies décident
    expect(sheet().queryByText("Nombre de séances")).toBeNull();

    const today = dayKey(Date.now());
    const d1 = addDays(today, 3);
    const d2 = addDays(today, 1);
    await fireEvent.press(sheet().getByTestId(`mini-day-${d1}`));
    await fireEvent.press(sheet().getByTestId(`mini-day-${d2}`));
    expect(sheet().getByTestId(`mini-day-${d1}`).props.accessibilityState).toMatchObject({ checked: true });
    // Aperçu dans l'ordre des dates
    expect(sheet().getByText("Séance 1/2 · 1 h")).toBeOnTheScreen();
    await fireEvent.press(sheet().getByRole("button", { name: "Créer les 2 séances" }));
    expect(onCreate.mock.calls[0][0].map((s: { day: string }) => s.day)).toEqual([d2, d1]);

    // Désélection
    await fireEvent.press(sheet().getByTestId(`mini-day-${d2}`));
    expect(sheet().getByTestId(`mini-day-${d2}`).props.accessibilityState).toMatchObject({ checked: false });
    const yesterday = sheet().queryByTestId(`mini-day-${addDays(today, -1)}`);
    if (yesterday) expect(yesterday.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
