import { getLocales } from "expo-localization";
import { useSyncExternalStore } from "react";
import { en } from "./en";
import { es } from "./es";
import { ptBR } from "./pt-BR";
import { de } from "./de";
import { itIT } from "./it";
import { id } from "./id";
import { ja } from "./ja";
import { ko } from "./ko";
import { zhHans } from "./zh-Hans";
import { fr, Translations } from "./fr";

// Langues disponibles, dans l'ordre du réglage « Langue »
export const LANGUAGES = ["fr", "en", "es", "pt-BR", "de", "it", "id", "ja", "ko", "zh-Hans"] as const;
export type Language = (typeof LANGUAGES)[number];

// Réglage « Langue » : « auto » suit la langue du téléphone
export type LanguagePreference = Language | "auto";

// Nom de chaque langue dans cette langue (jamais traduit)
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  de: "Deutsch",
  it: "Italiano",
  id: "Bahasa Indonesia",
  ja: "日本語",
  ko: "한국어",
  "zh-Hans": "简体中文",
};

export const TRANSLATIONS: Record<Language, Translations> = { fr, en, es, "pt-BR": ptBR, de, it: itIT, id, ja, ko, "zh-Hans": zhHans };

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === "auto" || (LANGUAGES as readonly unknown[]).includes(value);

// Variantes sans traduction propre : la langue disponible la plus proche
// (portugais du Portugal → du Brésil, chinois traditionnel → simplifié, ancien code de l'indonésien)
const NEAREST: Record<string, string> = { pt: "pt-BR", zh: "zh-Hans", in: "id" };

// Langue disponible la plus proche d'une langue du téléphone, sinon anglais
export function languageFor(locale: { languageCode?: string | null; languageTag?: string | null }): Language {
  const code = (locale.languageCode ?? locale.languageTag?.split("-")[0] ?? "").toLowerCase();
  const candidate = NEAREST[code] ?? code;
  return (LANGUAGES as readonly string[]).includes(candidate) ? (candidate as Language) : "en";
}

// Langue préférée du téléphone si elle est disponible, anglais sinon
export function detectLanguage(): Language {
  try {
    const locale = getLocales()[0];
    return locale ? languageFor(locale) : "en";
  } catch {
    return "en";
  }
}

let current: Language = detectLanguage();

// Textes de la langue courante. L'objet reste le même quand la langue change (ses rubriques sont
// remplacées) : t.x.y lu au moment de l'affichage donne toujours la bonne langue.
export const t: Translations = { ...TRANSLATIONS[current] };

const listeners = new Set<() => void>();

export const currentLanguage = (): Language => current;

// Applique le réglage « Langue » ; les écrans abonnés (useLanguage) se mettent à jour
export function setLanguagePreference(preference: LanguagePreference): void {
  const next = preference === "auto" ? detectLanguage() : preference;
  if (next === current) return;
  current = next;
  Object.assign(t, TRANSLATIONS[next]);
  for (const listener of [...listeners]) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Re-rend le composant quand la langue change
export const useLanguage = (): Language =>
  useSyncExternalStore(subscribeLanguage, currentLanguage, currentLanguage);

// Option à afficher dont le texte suit la langue courante (listes définies une fois au chargement)
export const translated = <V>(label: () => string, value: V): { readonly label: string; value: V } => ({
  get label() {
    return label();
  },
  value,
});
