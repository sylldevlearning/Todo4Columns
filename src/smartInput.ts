// Une importation par langue utilisée : les autres langues de chrono-node (arabe, finnois,
// néerlandais, suédois, ukrainien, vietnamien, chinois traditionnel) restent hors du bundle.
import type { Chrono, ParsedResult } from "chrono-node";
import * as de from "chrono-node/de";
import * as en from "chrono-node/en";
import * as es from "chrono-node/es";
import * as fr from "chrono-node/fr";
import * as id from "chrono-node/id";
import * as it from "chrono-node/it";
import * as ja from "chrono-node/ja";
import * as pt from "chrono-node/pt";
import * as ru from "chrono-node/ru";
import * as zhHans from "chrono-node/zh/hans";
import { Language } from "./i18n";

// Saisie intelligente, entièrement locale (sans IA ni serveur) : dans le titre tapé ou dicté,
// repère une date ou une heure (« demain à 15 h », « vendredi », « dans 2 jours ») et les mots
// « urgent » / « important ». Rien n'est appliqué ici : la fiche propose, l'utilisateur choisit.

// Analyseurs de chrono-node par langue de l'app ; les autres langues (coréen, turc, hindi) n'en
// ont pas : aucune date n'est proposée.
const PARSERS: Partial<Record<Language, Chrono>> = {
  en: en.casual,
  fr: fr.casual,
  es: es.casual,
  "pt-BR": pt.casual,
  de: de.casual,
  it: it.casual,
  ja: ja.casual,
  "zh-Hans": zhHans.casual,
  ru: ru.casual,
  id: id.casual,
};
export const supportsDates = (language: Language) => PARSERS[language] !== undefined;

// Heure par défaut d'une date sans heure (« vendredi ») : 9 h, comme les rappels d'étape
export const DEFAULT_HOUR = 9;

// Mots « urgent » et « important » de chaque langue (formes courantes)
const KEYWORDS: Record<Language, { urgent: string[]; important: string[] }> = {
  fr: { urgent: ["urgent", "urgente", "urgents", "urgentes", "urgence"], important: ["important", "importante", "importants", "importantes"] },
  en: { urgent: ["urgent", "asap"], important: ["important"] },
  es: { urgent: ["urgente", "urgentes"], important: ["importante", "importantes"] },
  "pt-BR": { urgent: ["urgente", "urgentes"], important: ["importante", "importantes"] },
  de: { urgent: ["dringend", "dringende", "dringender", "dringendes", "eilig"], important: ["wichtig", "wichtige", "wichtiger", "wichtiges"] },
  it: { urgent: ["urgente", "urgenti"], important: ["importante", "importanti"] },
  id: { urgent: ["mendesak", "segera"], important: ["penting"] },
  ja: { urgent: ["至急", "緊急", "急ぎ"], important: ["重要", "大事"] },
  ko: { urgent: ["긴급", "급함", "급한"], important: ["중요"] },
  "zh-Hans": { urgent: ["紧急", "加急", "急需"], important: ["重要"] },
  tr: { urgent: ["acil"], important: ["önemli"] },
  hi: { urgent: ["तुरंत", "अर्जेंट", "जल्दी"], important: ["ज़रूरी", "जरूरी", "महत्वपूर्ण"] },
  ru: { urgent: ["срочно", "срочный", "срочная", "срочное", "срочные"], important: ["важно", "важный", "важная", "важное", "важные"] },
};
// Langues écrites sans espaces : mot cherché tel quel dans le texte
const NO_SPACES: Language[] = ["ja", "zh-Hans", "ko"];

// Lettres (latines accentuées, cyrilliques, devanagari…) : une limite de mot est un caractère qui
// n'en est pas une. Pas de \p{L} : non garanti par tous les moteurs JavaScript.
const isLetter = (c: string | undefined) =>
  c !== undefined && (c.toLowerCase() !== c.toUpperCase() || /[ऀ-ॿ぀-ヿ一-鿿가-힯]/.test(c));

function containsWord(text: string, word: string, language: Language): boolean {
  const haystack = text.toLocaleLowerCase();
  if (NO_SPACES.includes(language)) return haystack.includes(word);
  let i = haystack.indexOf(word);
  while (i !== -1) {
    if (!isLetter(haystack[i - 1]) && !isLetter(haystack[i + word.length])) return true;
    i = haystack.indexOf(word, i + 1);
  }
  return false;
}

export interface DateSuggestion {
  due: number; // échéance proposée (timestamp en ms)
  text: string; // expression trouvée dans le titre
  title: string; // titre sans l'expression
}

export interface TitleAnalysis {
  date: DateSuggestion | null;
  urgent: boolean;
  important: boolean;
}

// Retire l'expression du titre et nettoie les espaces et la ponctuation laissés autour
export function removeExpression(title: string, index: number, text: string): string {
  const before = title.slice(0, index).replace(/[\s,;:–—-]+$/u, "");
  const after = title.slice(index + text.length).replace(/^[\s,;:–—-]+/u, "");
  return [before, after].filter((s) => s !== "").join(" ").replace(/\s{2,}/g, " ").trim();
}

// Écritures d'heure que chrono-node ne lit pas, ramenées à une forme qu'il lit :
// « 15 h », « 15 h 30 » (français) → « 15h », « 15h30 »
function normalize(title: string, language: Language): string {
  if (language !== "fr") return title;
  return title.replace(/(\d{1,2})\s+h(?:\s*(\d{2}))?(?![A-Za-zÀ-ÿ\d])/g, (_, h: string, m?: string) => `${h}h${m ?? ""}`);
}

// Heure écrite après la date et non lue par chrono-node (portugais : « amanhã às 15h ») :
// [heures, minutes, longueur du texte lu]
const TRAILING_TIME: Partial<Record<Language, RegExp>> = {
  "pt-BR": /^\s*(?:às|as)\s+(\d{1,2})(?:h|:)(\d{2})?/i,
};
function trailingTime(rest: string, language: Language): [number, number, number] | null {
  const match = TRAILING_TIME[language]?.exec(rest);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return [hours, minutes, match[0].length];
}

// Date ou heure du titre : la première expression qui tombe dans le futur. Une date sans heure
// prend 9 h ; une heure seule, le jour même (ou le lendemain si elle est passée).
export function detectDate(rawTitle: string, language: Language, now: number): DateSuggestion | null {
  const parser = PARSERS[language];
  if (!parser || rawTitle.trim() === "") return null;
  const title = normalize(rawTitle, language);
  let results: ParsedResult[];
  try {
    results = parser.parse(title, new Date(now), { forwardDate: true });
  } catch {
    return null;
  }
  for (const result of results) {
    const date = result.start.date();
    let text = result.text;
    const extra = result.start.isCertain("hour") ? null : trailingTime(title.slice(result.index + text.length), language);
    if (extra) {
      date.setHours(extra[0], extra[1], 0, 0);
      text = title.slice(result.index, result.index + text.length + extra[2]);
    } else if (!result.start.isCertain("hour")) date.setHours(DEFAULT_HOUR, 0, 0, 0);
    else if (!result.start.isCertain("minute")) date.setMinutes(0, 0, 0);
    else date.setSeconds(0, 0);
    let due = date.getTime();
    // Heure seule déjà passée aujourd'hui : demain
    if (due <= now && !result.start.isCertain("day") && !result.start.isCertain("weekday")) {
      date.setDate(date.getDate() + 1);
      due = date.getTime();
    }
    if (due <= now) continue;
    const cleaned = removeExpression(title, result.index, text);
    return { due, text, title: cleaned === "" ? title.trim() : cleaned };
  }
  return null;
}

export function analyzeTitle(title: string, language: Language, now: number): TitleAnalysis {
  const words = KEYWORDS[language];
  return {
    date: detectDate(title, language, now),
    urgent: words.urgent.some((w) => containsWord(title, w, language)),
    important: words.important.some((w) => containsWord(title, w, language)),
  };
}
