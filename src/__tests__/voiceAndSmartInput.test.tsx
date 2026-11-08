import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech-recognition";
import React from "react";
import { Alert, AlertButton } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TaskForm from "../components/TaskForm";
import { joinTranscript, SPEECH_LOCALES } from "../hooks/useVoiceInput";
import { LANGUAGES } from "../i18n";
import * as setup from "../notifications/setup";
import { DEFAULT_SETTINGS } from "../settings";
import { METRICS } from "../testing/metrics";
import { analyzeTitle, DEFAULT_HOUR, detectDate, removeExpression, supportsDates } from "../smartInput";

const speech = Speech.ExpoSpeechRecognitionModule as jest.Mocked<typeof Speech.ExpoSpeechRecognitionModule>;
const emit = (Speech as unknown as { __emit: (name: string, event: unknown) => void }).__emit;

// Dimanche 8 novembre 2026, 10 h (heure de Paris)
const NOW = new Date(2026, 10, 8, 10, 0).getTime();
const local = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();

describe("analyse des dates (locale, chrono-node)", () => {
  it.each([
    ["fr", "Appeler Paul demain à 15 h", local(9, 15), "Appeler Paul"],
    ["fr", "Appeler Paul demain à 15 h 30", local(9, 15, 30), "Appeler Paul"],
    ["fr", "Rendre le rapport vendredi", local(13, DEFAULT_HOUR), "Rendre le rapport"],
    ["fr", "Réunion dans 2 jours", local(10, DEFAULT_HOUR), "Réunion"],
    ["en", "Call mom tomorrow at 3pm", local(9, 15), "Call mom"],
    ["en", "Pay rent on Friday", local(13, DEFAULT_HOUR), "Pay rent"],
    ["es", "Llamar al taller mañana a las 15", local(9, 15), "Llamar al taller"],
    ["de", "Werkstatt am Freitag anrufen", local(13, DEFAULT_HOUR), "Werkstatt anrufen"],
    ["it", "Chiamare l'officina domani alle 15", local(9, 15), "Chiamare l'officina"],
    ["pt-BR", "Ligar para a oficina amanhã às 15h", local(9, 15), "Ligar para a oficina"],
    ["ru", "Позвонить завтра в 15:00", local(9, 15), "Позвонить"],
    ["ja", "明日の15時に電話", local(9, 15), "に電話"],
    ["id", "Telepon bengkel besok jam 15", local(9, 15), "Telepon bengkel"],
  ] as const)("%s : « %s »", (language, title, due, cleaned) => {
    const date = detectDate(title, language, NOW);
    expect(date).not.toBeNull();
    expect(new Date(date!.due).toString()).toBe(new Date(due).toString());
    expect(date!.title).toBe(cleaned);
  });

  it("heure seule déjà passée : le lendemain", () => {
    expect(detectDate("Dentiste à 9h", "fr", NOW)!.due).toBe(local(9, 9));
    expect(detectDate("Dentiste à 15h", "fr", NOW)!.due).toBe(local(8, 15));
  });

  it("langues sans analyseur (coréen, turc, hindi) et titres sans date : rien", () => {
    for (const language of ["ko", "tr", "hi"] as const) {
      expect(supportsDates(language)).toBe(false);
      expect(detectDate("내일 오후 3시 전화", language, NOW)).toBeNull();
    }
    expect(detectDate("Acheter du pain", "fr", NOW)).toBeNull();
    expect(detectDate("", "fr", NOW)).toBeNull();
  });

  it("expression retirée proprement", () => {
    expect(removeExpression("Appeler, demain, Paul", 9, "demain")).toBe("Appeler Paul");
    expect(removeExpression("demain : rapport", 0, "demain")).toBe("rapport");
  });
});

describe("mots « urgent » et « important »", () => {
  it.each([
    ["fr", "Facture urgente à payer", true, false],
    ["fr", "Rendez-vous important", false, true],
    ["en", "URGENT: call the bank", true, false],
    ["en", "Not unimportant at all", false, false], // pas de mot entier
    ["es", "Pago urgente", true, false],
    ["de", "Wichtiger Termin", false, true],
    ["it", "Pratica urgente e importante", true, true],
    ["pt-BR", "Reunião importante", false, true],
    ["id", "Laporan penting", false, true],
    ["ja", "至急、見積もりを送る", true, false],
    ["ko", "중요 회의", false, true],
    ["zh-Hans", "紧急处理发票", true, false],
    ["tr", "Acil fatura", true, false],
    ["hi", "ज़रूरी मीटिंग", false, true],
    ["ru", "Срочно позвонить", true, false],
  ] as const)("%s : « %s »", (language, title, urgent, important) => {
    const result = analyzeTitle(title, language, NOW);
    expect([result.urgent, result.important]).toEqual([urgent, important]);
  });

  it("une langue de reconnaissance vocale pour chaque langue de l'app", () => {
    for (const language of LANGUAGES) expect(SPEECH_LOCALES[language]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
  });
});

describe("fiche : suggestions", () => {
  it("date proposée, appliquée sur demande : échéance réglée et expression retirée du titre", async () => {
    const onSubmit = jest.fn();
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Appeler Paul demain à 15 h");
    // Rien n'est modifié sans appui
    expect(screen.getByLabelText("Titre")).toHaveDisplayValue("Appeler Paul demain à 15 h");
    expect(screen.getByText(/^Échéance : /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.getByLabelText("Titre")).toHaveDisplayValue("Appeler Paul");
    expect(screen.queryByText(/^Échéance : /)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: /^Ajouter à/ }));
    const values = onSubmit.mock.calls[0][0];
    expect(values).toMatchObject({ title: "Appeler Paul", category: "INU" });
    const due = new Date(values.dueAt);
    expect([due.getHours(), due.getMinutes()]).toEqual([15, 0]);
  });

  it("« Ignorer » retire la suggestion, le titre reste tel quel", async () => {
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Rapport vendredi");
    await fireEvent.press(screen.getByRole("button", { name: /^Ignorer : Échéance/ }));
    expect(screen.queryByText(/^Échéance : /)).toBeNull();
    expect(screen.getByLabelText("Titre")).toHaveDisplayValue("Rapport vendredi");
  });

  it("« urgent » suggère l'interrupteur sans le forcer ; « Si j'ai le temps » passe en Planifier avec une date", async () => {
    await render(<TaskForm initialCategory="NDNI" settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Facture urgente");
    expect(screen.getByLabelText("C'est urgent ?")).toHaveProp("value", false);
    expect(screen.getByText("Le titre dit « urgent »")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Activer" }));
    expect(screen.getByLabelText("C'est urgent ?")).toHaveProp("value", true);
    expect(screen.queryByText("Le titre dit « urgent »")).toBeNull();

    await fireEvent(screen.getByLabelText("C'est urgent ?"), "valueChange", false);
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Trier les photos samedi");
    await fireEvent.press(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.getByText("→ Planifier")).toBeOnTheScreen();
  });
});

describe("dictée", () => {
  let alerts: { title: string; message?: string; buttons?: AlertButton[] }[];
  beforeEach(() => {
    alerts = [];
    jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
      alerts.push({ title, message, buttons });
    });
    speech.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" } as never);
    speech.requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" } as never);
    speech.isRecognitionAvailable.mockReturnValue(true);
    speech.start.mockClear();
    speech.stop.mockClear();
    speech.requestPermissionsAsync.mockClear();
  });

  const pressMic = async () => {
    await fireEvent.press(screen.getByRole("button", { name: "Dicter le titre" }));
    await act(async () => {});
  };

  it("autorisée : écoute dans la langue de l'app, transcription en direct ajoutée au titre, arrêt", async () => {
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText("Titre"), "Courses :");
    await pressMic();
    expect(speech.requestPermissionsAsync).not.toHaveBeenCalled(); // déjà accordée
    expect(speech.start).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "fr-FR", interimResults: true, continuous: false, androidIntentOptions: { EXTRA_PREFER_OFFLINE: true } })
    );

    await act(async () => emit("start", {}));
    expect(screen.getByRole("button", { name: "Arrêter la dictée" })).toBeOnTheScreen();
    expect(screen.getByText("À l'écoute… parle maintenant")).toBeOnTheScreen();
    await act(async () => emit("result", { isFinal: false, results: [{ transcript: "pain" }] }));
    expect(screen.getByLabelText("Titre")).toHaveDisplayValue("Courses : pain");
    await act(async () => emit("result", { isFinal: true, results: [{ transcript: "pain et lait" }] }));
    expect(screen.getByLabelText("Titre")).toHaveDisplayValue("Courses : pain et lait");

    await fireEvent.press(screen.getByRole("button", { name: "Arrêter la dictée" }));
    expect(speech.stop).toHaveBeenCalled();
    await act(async () => emit("end", {}));
    expect(screen.getByRole("button", { name: "Dicter le titre" })).toBeOnTheScreen();
  });

  it("premier appui : autorisation demandée ; accordée, l'écoute démarre", async () => {
    speech.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: "undetermined" } as never);
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    expect(speech.requestPermissionsAsync).not.toHaveBeenCalled(); // pas à l'ouverture
    await pressMic();
    expect(speech.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(speech.start).toHaveBeenCalled();
  });

  it("refusée : message et « Ouvrir les réglages », pas d'écoute", async () => {
    const open = jest.spyOn(setup, "openSystemSettings").mockImplementation(async () => {});
    speech.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: "undetermined" } as never);
    speech.requestPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false, status: "denied" } as never);
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    await pressMic();
    expect(speech.start).not.toHaveBeenCalled();
    expect(alerts.at(-1)!.title).toBe("Micro non autorisé");
    const settings = alerts.at(-1)!.buttons!.find((b) => b.text === "Ouvrir les réglages")!;
    settings.onPress?.();
    expect(open).toHaveBeenCalled();

    // Refus définitif : plus de fenêtre système, directement le message
    speech.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false, status: "denied" } as never);
    await pressMic();
    expect(speech.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(alerts.at(-1)!.title).toBe("Micro non autorisé");
  });

  it("reconnaissance absente : message ; silence ou arrêt : aucun message", async () => {
    speech.isRecognitionAvailable.mockReturnValueOnce(false);
    await render(<TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />);
    await pressMic();
    expect(alerts.at(-1)!.title).toBe("Dictée indisponible");
    alerts = [];
    await pressMic();
    await act(async () => emit("error", { error: "no-speech", message: "" }));
    expect(alerts).toEqual([]);
    await act(async () => emit("error", { error: "network", message: "" }));
    expect(alerts.at(-1)!.title).toBe("Dictée interrompue");
  });

  it("appui long sur « + » : la fiche démarre l'écoute directement", async () => {
    await render(<TaskForm settings={DEFAULT_SETTINGS} autoStartVoice onSubmit={() => {}} />);
    await act(async () => {});
    expect(speech.start).toHaveBeenCalledTimes(1);
  });

  it("« i » du micro", async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TaskForm settings={DEFAULT_SETTINGS} onSubmit={() => {}} />
      </SafeAreaProvider>
    );
    await fireEvent.press(screen.getByLabelText("En savoir plus : Dictée"));
    expect(screen.getByText(/rien n'est enregistré/)).toBeOnTheScreen();
  });

  it("texte de départ et transcription", () => {
    expect(joinTranscript("", " bonjour ")).toBe("bonjour");
    expect(joinTranscript("Appeler ", "Paul")).toBe("Appeler Paul");
    expect(joinTranscript("Appeler", "")).toBe("Appeler");
  });
});
