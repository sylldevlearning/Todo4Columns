import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import SettingsForm from "../components/SettingsForm";
import { DEFAULT_SETTINGS } from "../settings";
import { makeTask } from "../testing/makeTask";

const setup = async (overrides: Partial<React.ComponentProps<typeof SettingsForm>> = {}) => {
  const props = {
    settings: DEFAULT_SETTINGS,
    onChange: jest.fn(),
    permission: "granted" as const,
    onRequestPermission: jest.fn(),
    onOpenSystemSettings: jest.fn(),
    archivedTasks: [],
    onRestore: jest.fn(),
    onDeleteForever: jest.fn(),
    ...overrides,
  };
  await render(<SettingsForm {...props} />);
  return props;
};

describe("SettingsForm", () => {
  it("modifie les délais par défaut de chaque quadrant", async () => {
    const props = await setup();

    expect(screen.getAllByRole("radio", { name: "2 h" })[0]).toBeSelected();
    await fireEvent.press(screen.getAllByRole("radio", { name: "30 min" })[0]);
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, doNagInterval: 30 });

    await fireEvent.press(screen.getByRole("radio", { name: "Le jour J" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, planReminderOffset: 0 });

    await fireEvent.press(screen.getByRole("radio", { name: "1 semaine" }));
    expect(props.onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      delegateFollowUp: 7 * 24 * 60,
    });
  });

  it("règle la répétition et le maximum de relances", async () => {
    const props = await setup();

    await fireEvent(screen.getByLabelText("Répéter jusqu'à ce que ce soit fait"), "valueChange", true);
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, nagRepeat: true });

    await fireEvent.press(screen.getByRole("radio", { name: "5" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, maxNags: 5 });
  });

  it("affiche l'état de l'autorisation et les liens", async () => {
    const props = await setup({ permission: "undetermined" });

    expect(screen.getByText("Pas encore demandées")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Autoriser les notifications" }));
    await fireEvent.press(screen.getByRole("button", { name: "Ouvrir les réglages du téléphone" }));
    expect(props.onRequestPermission).toHaveBeenCalled();
    expect(props.onOpenSystemSettings).toHaveBeenCalled();
  });

  it("active l'archivage automatique, désactivé par défaut", async () => {
    const props = await setup();
    const label = "Archiver automatiquement les tâches « Si j'ai le temps » après 7 jours";

    expect(screen.getByLabelText(label)).toHaveProp("value", false);
    expect(screen.getByText("Les tâches archivées apparaissent ici.")).toBeOnTheScreen();
    await fireEvent(screen.getByLabelText(label), "valueChange", true);
    expect(props.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, autoArchive: true });
  });

  it("liste les archives avec Restaurer et Supprimer définitivement", async () => {
    const props = await setup({
      archivedTasks: [makeTask({ id: "x", title: "Trier les mails", category: "NDNI", archivedAt: 5 })],
    });

    expect(screen.getByText("Archives · 1")).toBeOnTheScreen();
    expect(screen.getByText("Trier les mails")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Restaurer" }));
    await fireEvent.press(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(props.onRestore).toHaveBeenCalledWith("x");
    expect(props.onDeleteForever).toHaveBeenCalledWith("x");
  });
});
