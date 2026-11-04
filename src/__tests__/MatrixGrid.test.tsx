import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import MatrixGrid from "../components/MatrixGrid";
import { makeTask } from "../testing/makeTask";
import { Category, Task } from "../types";

const task = (id: string, category: Category, extra: Partial<Task> = {}): Task =>
  makeTask({ id, title: `Tâche ${id}`, category, ...extra });

describe("MatrixGrid", () => {
  const tasks = [
    task("1", "UI"),
    task("2", "UI"),
    task("3", "UI"),
    task("4", "UI"),
    task("5", "UI"),
    task("6", "UI", { isDone: true }),
    task("7", "INU", { dueAt: new Date(2026, 9, 23, 14, 0).getTime() }),
    task("8", "NDNI", { archivedAt: 5 }),
  ];

  it("affiche les quatre quadrants et les axes", async () => {
    await render(<MatrixGrid tasks={tasks} onOpenQuadrant={() => {}} />);

    for (const name of ["Faire", "Planifier", "Déléguer", "Si j'ai le temps"]) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
    for (const sub of ["Maintenant", "Bloquer un créneau", "Confier et relancer", "Plus tard, peut-être"]) {
      expect(screen.getByText(sub)).toBeOnTheScreen();
    }
    for (const axis of ["Urgent", "Pas urgent", "Important", "Pas important"]) {
      expect(screen.getByText(axis)).toBeOnTheScreen();
    }
  });

  it("montre les 3 premières tâches non terminées, le compteur et « +N autres »", async () => {
    await render(<MatrixGrid tasks={tasks} onOpenQuadrant={() => {}} />);

    expect(screen.getByText("Tâche 1")).toBeOnTheScreen();
    expect(screen.getByText("Tâche 3")).toBeOnTheScreen();
    expect(screen.queryByText("Tâche 4")).toBeNull();
    expect(screen.queryByText("Tâche 6")).toBeNull(); // terminée
    expect(screen.queryByText("Tâche 8")).toBeNull(); // archivée
    expect(screen.getByText("+2 autres")).toBeOnTheScreen();
    expect(screen.getByText("5")).toBeOnTheScreen();
    expect(screen.getAllByText("Aucune tâche")).toHaveLength(2);
  });

  it("affiche l'échéance d'une tâche", async () => {
    await render(<MatrixGrid tasks={tasks} onOpenQuadrant={() => {}} />);
    expect(screen.getByText(/23 oct/)).toBeOnTheScreen();
  });

  it("ouvre le quadrant touché", async () => {
    const onOpen = jest.fn();
    await render(<MatrixGrid tasks={tasks} onOpenQuadrant={onOpen} />);

    await fireEvent.press(screen.getByLabelText("Planifier, 1 tâche à faire"));
    expect(onOpen).toHaveBeenCalledWith("INU");
  });
});
