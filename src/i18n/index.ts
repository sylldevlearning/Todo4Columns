import { getLocales } from "expo-localization";
import { en } from "./en";
import { fr, Translations } from "./fr";

export type Language = "fr" | "en";

// Français si la langue préférée du téléphone est le français, anglais sinon
export function detectLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export const TRANSLATIONS: Record<Language, Translations> = { fr, en };

// Langue choisie une fois au démarrage
export const language: Language = detectLanguage();
export const t: Translations = TRANSLATIONS[language];
