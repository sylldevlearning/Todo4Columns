import { fireEvent, render as renderScreen, screen } from "@testing-library/react-native";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import InfoButton, { InfoKey, shouldDismiss } from "../components/InfoButton";
import SettingsForm from "../components/SettingsForm";
import TaskForm from "../components/TaskForm";
import { en } from "../i18n/en";
import { fr } from "../i18n/fr";
import { DEFAULT_SETTINGS } from "../settings";
import { TOUCH_SIZE } from "../theme";

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};
const render = (ui: React.ReactElement) =>
  renderScreen(<SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>);

const INFO_KEYS = Object.keys(fr.help.info) as InfoKey[];

describe("InfoButton", () => {
  it("a un label pour les lecteurs d'écran et une zone de toucher de 44 px", async () => {
    await render(<InfoButton info="urgent" />);
    const button = screen.getByRole("button", { name: "En savoir plus : C'est urgent ?" });
    expect(button).toHaveStyle({ width: TOUCH_SIZE, height: TOUCH_SIZE });
    expect(TOUCH_SIZE).toBeGreaterThanOrEqual(44);
  });

  it("ouvre une carte avec titre, explication et exemple, puis la ferme par un appui à côté", async () => {
    await render(<InfoButton info="urgent" />);
    expect(screen.queryByText(fr.help.info.urgent.body)).toBeNull();

    await fireEvent.press(screen.getByLabelText("En savoir plus : C'est urgent ?"));
    expect(screen.getByRole("header", { name: "C'est urgent ?" })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Est-ce que ça doit être fait aujourd'hui ou demain ? Si oui, c'est urgent. Sinon, ça peut attendre un moment choisi, même si c'est important."
      )
    ).toBeOnTheScreen();
    expect(screen.getByText(/^Exemple : une facture à payer avant demain/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByText(fr.help.info.urgent.body)).toBeNull();
  });

  it("se ferme avec le bouton retour d'Android", async () => {
    await render(<InfoButton info="quietHours" />);
    await fireEvent.press(screen.getByLabelText("En savoir plus : Plage silencieuse"));
    expect(screen.getByText(fr.help.info.quietHours.body)).toBeOnTheScreen();

    await fireEvent(screen.getByTestId("info-sheet"), "requestClose");
    expect(screen.queryByText(fr.help.info.quietHours.body)).toBeNull();
  });

  it("se ferme par un glissement vers le bas, pas par un petit mouvement", () => {
    expect(shouldDismiss(120, 0)).toBe(true);
    expect(shouldDismiss(30, 1.5)).toBe(true); // glissement rapide
    expect(shouldDismiss(30, 0.2)).toBe(false);
    expect(shouldDismiss(-200, 0)).toBe(false); // vers le haut
  });
});

describe("boutons « i » placés dans les écrans", () => {
  it("fiche de tâche : Urgent, Important et les rappels de chaque quadrant", async () => {
    await render(<TaskForm initialCategory="UI" settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    for (const title of ["C'est urgent ?", "C'est important ?", "Relance", "Répéter la relance"]) {
      expect(screen.getByLabelText(`En savoir plus : ${title}`)).toBeOnTheScreen();
    }

    await fireEvent(screen.getByLabelText("C'est urgent ?"), "valueChange", false);
    expect(screen.getByLabelText("En savoir plus : Me rappeler")).toBeOnTheScreen();

    await fireEvent(screen.getByLabelText("C'est urgent ?"), "valueChange", true);
    await fireEvent(screen.getByLabelText("C'est important ?"), "valueChange", false);
    expect(screen.getByLabelText("En savoir plus : Confié à")).toBeOnTheScreen();
    expect(screen.getByLabelText("En savoir plus : Relancer la personne")).toBeOnTheScreen();
  });

  it("réglages : relance, répétition, rappels, plage silencieuse, archivage, célébrations", async () => {
    await render(
      <SettingsForm
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        permission="granted"
        onRequestPermission={() => {}}
        onOpenSystemSettings={() => {}}
        archivedTasks={[]}
        onRestore={() => {}}
        onDeleteForever={() => {}}
      />
    );
    for (const key of [
      "nag",
      "repeat",
      "reminder",
      "followUp",
      "quietHours",
      "autoArchive",
      "celebrations",
    ] as InfoKey[]) {
      expect(screen.getByLabelText(`En savoir plus : ${fr.help.info[key].title}`)).toBeOnTheScreen();
    }
  });
});

describe("textes des cartes d'info", () => {
  it.each(INFO_KEYS)("%s : titre, 1 à 3 phrases et un exemple, en français et en anglais", (key) => {
    for (const lang of [fr, en]) {
      const { title, body, example } = lang.help.info[key];
      expect(title.trim()).not.toBe("");
      expect(example.trim()).not.toBe("");
      const sentences = body.split(/[.?!](?:\s|$)/).filter((x) => x.trim() !== "");
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences.length).toBeLessThanOrEqual(3);
    }
    expect(en.help.info[key].body).not.toBe(fr.help.info[key].body);
  });

  it("les quadrants ont une carte nommée comme eux", () => {
    for (const lang of [fr, en]) {
      for (const key of ["UI", "INU", "UDI", "NDNI"] as const) {
        expect(lang.help.info[key].title).toBe(lang.categories[key].name);
      }
    }
  });
});
