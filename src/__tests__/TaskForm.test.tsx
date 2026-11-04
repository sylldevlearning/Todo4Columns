import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import TaskForm from "../components/TaskForm";
import { DEFAULT_SETTINGS } from "../settings";
import { makeTask } from "../testing/makeTask";

const existing = makeTask({
  title: "Relancer le devis",
  category: "UDI",
  nagInterval: 10080,
  delegatedTo: "Marie",
});

describe("TaskForm", () => {
  it("déduit le quadrant des interrupteurs et adapte les options", async () => {
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);

    // Par défaut : important, pas urgent
    expect(screen.getByText("→ Planifier")).toBeOnTheScreen();
    expect(screen.getByText("Me rappeler")).toBeOnTheScreen();
    expect(screen.getByText("Ajouter une échéance")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "La veille" })).toBeSelected();

    await fireEvent(screen.getByLabelText("C'est urgent ?"), "valueChange", true);
    expect(screen.getByText("→ Faire")).toBeOnTheScreen();
    expect(screen.getByText("Relancer si pas faite après")).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "2 h" })).toBeSelected();
    expect(screen.getByText("Répéter jusqu'à ce que ce soit fait (3 max)")).toBeOnTheScreen();

    await fireEvent(screen.getByLabelText("C'est important ?"), "valueChange", false);
    expect(screen.getByText("→ Déléguer")).toBeOnTheScreen();
    expect(screen.getByText("Relancer la personne")).toBeOnTheScreen();

    await fireEvent(screen.getByLabelText("C'est urgent ?"), "valueChange", false);
    expect(screen.getByText("→ Si j'ai le temps")).toBeOnTheScreen();
    // Archivage automatique désactivé par défaut
    expect(screen.getByText("Pas de rappel.")).toBeOnTheScreen();
  });

  it("annonce l'archivage dans 7 jours quand l'option est activée", async () => {
    await render(
      <TaskForm
        initialCategory="NDNI"
        settings={{ ...DEFAULT_SETTINGS, autoArchive: true }}
        onSubmit={() => {}}
      />
    );
    expect(
      screen.getByText("Pas de rappel. La tâche sera archivée automatiquement dans 7 jours.")
    ).toBeOnTheScreen();
  });

  it("pré-remplit les interrupteurs depuis un quadrant et crée la tâche", async () => {
    const onSubmit = jest.fn();
    await render(
      <TaskForm initialCategory="UI" settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />
    );

    expect(screen.getByLabelText("C'est urgent ?")).toHaveProp("value", true);
    expect(screen.getByLabelText("C'est important ?")).toHaveProp("value", true);

    const submit = screen.getByRole("button", { name: "Ajouter à « Faire »" });
    expect(submit).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText("Titre"), "  Appeler le client ");
    await fireEvent.press(screen.getByRole("radio", { name: "30 min" }));
    await fireEvent(
      screen.getByLabelText("Répéter jusqu'à ce que ce soit fait (3 max)"),
      "valueChange",
      true
    );
    await fireEvent.press(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      title: "Appeler le client",
      category: "UI",
      dueAt: null,
      reminderOffset: null,
      nagInterval: 30,
      nagRepeat: true,
      delegatedTo: null,
      recurrence: null,
      steps: [],
    });
  });

  it("modifie une tâche existante en gardant ses réglages", async () => {
    const onSubmit = jest.fn();
    await render(<TaskForm task={existing} settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);

    expect(screen.getByText("Modifier la tâche")).toBeOnTheScreen();
    expect(screen.getByText("→ Déléguer")).toBeOnTheScreen();
    expect(screen.getByLabelText("Confié à")).toHaveDisplayValue("Marie");
    expect(screen.getByRole("radio", { name: "1 semaine" })).toBeSelected();

    await fireEvent.changeText(screen.getByLabelText("Confié à"), "Paul");
    await fireEvent.press(screen.getByRole("button", { name: "Enregistrer" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Relancer le devis",
        category: "UDI",
        delegatedTo: "Paul",
        nagInterval: 10080,
      })
    );
  });
});
