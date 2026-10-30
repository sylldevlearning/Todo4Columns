import { render, screen } from "@testing-library/react-native";
import React from "react";
import MatrixGrid, { nameLines } from "../components/MatrixGrid";
import { formatDuration, formatToday } from "../format";
import { Language, LANGUAGE_NAMES, LANGUAGES, languageFor, setLanguagePreference, t, TRANSLATIONS } from "../i18n";
import { fonts } from "../theme";

afterEach(() => setLanguagePreference("auto"));

describe("langue automatique : variantes", () => {
  it.each([
    [{ languageCode: "pt", languageTag: "pt-PT" }, "pt-BR"], // portugais du Portugal
    [{ languageCode: "pt", languageTag: "pt-BR" }, "pt-BR"],
    [{ languageCode: "zh", languageTag: "zh-Hant-TW" }, "zh-Hans"], // chinois traditionnel
    [{ languageCode: "zh", languageTag: "zh-Hans-CN" }, "zh-Hans"],
    [{ languageCode: "in", languageTag: "in-ID" }, "id"], // ancien code Android de l'indonésien
    [{ languageCode: "de", languageTag: "de-AT" }, "de"],
    [{ languageCode: "es", languageTag: "es-MX" }, "es"],
    [{ languageCode: "ja", languageTag: "ja-JP" }, "ja"],
    [{ languageCode: "ko", languageTag: "ko-KR" }, "ko"],
    [{ languageCode: "tr", languageTag: "tr-TR" }, "tr"],
    [{ languageCode: "hi", languageTag: "hi-IN" }, "hi"],
    [{ languageCode: "ru", languageTag: "ru-RU" }, "ru"],
    [{ languageCode: "uk", languageTag: "uk-UA" }, "en"], // langue absente : anglais
    [{ languageCode: "ar", languageTag: "ar-EG" }, "en"],
  ])("%j → %s", (locale, expected) => {
    expect(languageFor(locale)).toBe(expected);
  });
});

describe("13 langues", () => {
  it("dans l'ordre du réglage, chacune sous son nom natif", () => {
    expect(LANGUAGES.map((l) => LANGUAGE_NAMES[l])).toEqual([
      "Français",
      "English",
      "Español",
      "Português (Brasil)",
      "Deutsch",
      "Italiano",
      "Bahasa Indonesia",
      "日本語",
      "한국어",
      "简体中文",
      "Türkçe",
      "हिन्दी",
      "Русский",
    ]);
  });

  it.each(LANGUAGES)("%s : choisie, elle remplace tous les textes", (language) => {
    setLanguagePreference(language);
    expect(t).toEqual(TRANSLATIONS[language]);
  });

  it("dates formatées dans la langue choisie", () => {
    const day = new Date(2026, 9, 22);
    const today = (language: Language) => {
      setLanguagePreference(language);
      return formatToday(day);
    };
    expect(today("de")).toBe("Donnerstag, 22. Oktober");
    expect(today("es")).toBe("Jueves, 22 de octubre");
    expect(today("ru")).toBe("Четверг, 22 октября");
    expect(today("ja")).toBe("10月22日木曜日");
    // Chaque langue a son format, distinct de l'anglais
    const english = today("en");
    for (const language of LANGUAGES.filter((l) => l !== "en")) {
      expect(today(language)).not.toBe(english);
    }
  });

  it("durées avec les unités de la langue", () => {
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    const duration = (language: Language) => {
      setLanguagePreference(language);
      return formatDuration(twoDays);
    };
    expect(duration("de")).toBe("2 T.");
    expect(duration("ja")).toBe("2日");
    expect(duration("ru")).toBe("2 д");
  });
});

describe("mise en page des textes longs", () => {
  it("nom d'un seul mot sur une ligne (réduit, jamais coupé en plein mot), deux lignes sinon", () => {
    expect(nameLines("Планировать")).toBe(1);
    expect(nameLines("Irgendwann")).toBe(1);
    expect(nameLines("Si j'ai le temps")).toBe(2);
    expect(nameLines("Если будет время")).toBe(2);
  });

  it("grille en russe : noms et sous-titres réduits plutôt que tronqués", async () => {
    setLanguagePreference("ru");
    await render(<MatrixGrid tasks={[]} onOpenQuadrant={() => {}} />);

    const name = screen.getByText("Планировать");
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.adjustsFontSizeToFit).toBe(true);
    expect(screen.getByText("Если будет время").props.numberOfLines).toBe(2);

    const subtitle = screen.getByText(TRANSLATIONS.ru.categories.UDI.subtitle);
    expect(subtitle.props.numberOfLines).toBe(2);
    expect(subtitle.props.adjustsFontSizeToFit).toBe(true);
  });
});

const { readFileSync } = require("fs") as { readFileSync: (path: string) => Uint8Array };

// Caractères présents dans une police TrueType (table cmap, formats 4 et 12)
function fontCharacters(path: string): Set<number> {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const data = { readUInt16BE: (o: number) => view.getUint16(o), readUInt32BE: (o: number) => view.getUint32(o) };
  const tables = new Map<string, number>();
  for (let i = 0; i < data.readUInt16BE(4); i++) {
    const tag = String.fromCharCode(...bytes.subarray(12 + 16 * i, 16 + 16 * i));
    tables.set(tag, data.readUInt32BE(20 + 16 * i));
  }
  const cmap = tables.get("cmap")!;
  const chars = new Set<number>();
  for (let i = 0; i < data.readUInt16BE(cmap + 2); i++) {
    const table = cmap + data.readUInt32BE(cmap + 8 + 8 * i);
    const format = data.readUInt16BE(table);
    if (format === 4) {
      const segments = data.readUInt16BE(table + 6) / 2;
      for (let s = 0; s < segments; s++) {
        const end = data.readUInt16BE(table + 14 + 2 * s);
        const start = data.readUInt16BE(table + 16 + 2 * segments + 2 * s);
        for (let c = start; c <= end && c !== 0xffff; c++) chars.add(c);
      }
    } else if (format === 12) {
      for (let g = 0; g < data.readUInt32BE(table + 12); g++) {
        const start = data.readUInt32BE(table + 16 + 12 * g);
        const end = data.readUInt32BE(table + 20 + 12 * g);
        for (let c = start; c <= end; c++) chars.add(c);
      }
    }
  }
  return chars;
}

const textsOf = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "function"
      ? [] // gabarits : leurs textes fixes sont vérifiés via les autres langues
      : typeof value === "object" && value
        ? Object.values(value).flatMap(textsOf)
        : [];

describe("polices", () => {
  const manrope = (weight: string) =>
    fontCharacters(`node_modules/@expo-google-fonts/manrope/${weight}/Manrope_${weight}.ttf`);
  const weights = Object.values(fonts).map((family) => family.replace("Manrope_", ""));

  // Alphabets latin et cyrillique : Manrope a tous les caractères, dans chaque graisse
  it.each(["fr", "en", "es", "pt-BR", "de", "it", "id", "tr", "ru"] as Language[])(
    "%s : tous les caractères sont dans Manrope",
    (language) => {
      const used = new Set(
        [...textsOf(TRANSLATIONS[language]).join(""), ...LANGUAGE_NAMES[language]]
          .filter((c) => c.trim() !== "")
          .map((c) => c.codePointAt(0)!)
      );
      for (const weight of weights) {
        const font = manrope(weight);
        expect([...used].filter((c) => !font.has(c)).map((c) => String.fromCodePoint(c))).toEqual([]);
      }
    }
  );

  // Japonais, coréen, chinois, hindi : absents de Manrope, la police système du téléphone
  // prend le relais caractère par caractère (aucune police lourde embarquée)
  it.each(["ja", "ko", "zh-Hans", "hi"] as Language[])("%s : police système", (language) => {
    const font = manrope("400Regular");
    expect([...TRANSLATIONS[language].categories.UI.name].some((c) => !font.has(c.codePointAt(0)!))).toBe(
      true
    );
  });
});
