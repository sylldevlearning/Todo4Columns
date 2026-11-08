import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { showAlert } from "../appWindows";
import { currentLanguage, Language, t } from "../i18n";
import { openSystemSettings } from "../notifications/setup";

// Dictée du titre avec la reconnaissance vocale du téléphone (expo-speech-recognition).
// Sur Android, la reconnaissance se fait sur l'appareil quand un modèle hors ligne est installé
// (EXTRA_PREFER_OFFLINE), sinon par le service de reconnaissance du téléphone. Aucun audio n'est
// enregistré par l'app. L'écoute s'arrête toute seule après un silence (continuous: false).

// Langue de reconnaissance : celle de l'app
export const SPEECH_LOCALES: Record<Language, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  "pt-BR": "pt-BR",
  de: "de-DE",
  it: "it-IT",
  id: "id-ID",
  ja: "ja-JP",
  ko: "ko-KR",
  "zh-Hans": "zh-CN",
  tr: "tr-TR",
  hi: "hi-IN",
  ru: "ru-RU",
};

// Erreurs sans message : l'utilisateur a arrêté, ou n'a rien dit
const SILENT_ERRORS = new Set(["aborted", "no-speech", "speech-timeout"]);

// Texte affiché pendant la dictée : ce qui était déjà dans le champ, puis la transcription
export const joinTranscript = (base: string, transcript: string) =>
  [base.trimEnd(), transcript.trim()].filter((s) => s !== "").join(" ");

interface Options {
  onText: (text: string) => void; // transcription en direct (ajoutée au texte de départ)
  onEnd?: () => void;
}

export function useVoiceInput({ onText, onEnd }: Options) {
  const [listening, setListening] = useState(false);
  // Texte du champ au début de la dictée
  const base = useRef("");
  const handlers = useRef({ onText, onEnd });
  handlers.current = { onText, onEnd };

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    handlers.current.onEnd?.();
  });
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    handlers.current.onText(joinTranscript(base.current, transcript));
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (SILENT_ERRORS.has(event.error)) return;
    if (event.error === "not-allowed") showDenied();
    else if (event.error === "service-not-allowed" || event.error === "language-not-supported") {
      showAlert(t.voice.unavailableTitle, t.voice.unavailableBody);
    } else showAlert(t.voice.errorTitle, t.voice.errorBody);
  });

  // Fiche fermée pendant la dictée : l'écoute s'arrête
  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);

  // Autorisation du micro, demandée seulement au premier appui. Refusée : message et réglages.
  const ensurePermission = async (): Promise<boolean> => {
    const current = await ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const asked = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (asked.granted) return true;
    }
    showDenied();
    return false;
  };

  const start = async (currentText: string) => {
    if (listening) return;
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        showAlert(t.voice.unavailableTitle, t.voice.unavailableBody);
        return;
      }
      if (!(await ensurePermission())) return;
      base.current = currentText;
      ExpoSpeechRecognitionModule.start({
        lang: SPEECH_LOCALES[currentLanguage()],
        interimResults: true,
        continuous: false,
        addsPunctuation: false,
        androidIntentOptions: { EXTRA_PREFER_OFFLINE: true },
      });
    } catch (e) {
      console.warn("Dictée impossible :", e instanceof Error ? e.message : e);
      showAlert(t.voice.errorTitle, t.voice.errorBody);
    }
  };

  const stop = () => ExpoSpeechRecognitionModule.stop();

  return { listening, start, stop };
}

function showDenied() {
  showAlert(t.voice.deniedTitle, t.voice.deniedBody, [
    { text: t.common.cancel, style: "cancel" },
    { text: t.permissionCard.openSettings, onPress: openSystemSettings },
  ]);
}
