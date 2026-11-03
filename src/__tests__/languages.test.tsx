import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";
import MatrixGrid, { nameLines } from "../components/MatrixGrid";
import { formatDue, formatDuration, formatToday } from "../format";
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
    expect(nameLines("Когда-нибудь")).toBe(1);
    expect(nameLines("Если будет время")).toBe(2);
  });

  it("grille en russe : noms et sous-titres réduits plutôt que tronqués", async () => {
    setLanguagePreference("ru");
    await render(<MatrixGrid tasks={[]} onOpenQuadrant={() => {}} />);

    const name = screen.getByText("Планировать");
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.adjustsFontSizeToFit).toBe(true);
    const someday = screen.getByText("Когда-нибудь");
    expect(someday.props.numberOfLines).toBe(1);
    expect(someday.props.adjustsFontSizeToFit).toBe(true);

    const subtitle = screen.getByText(TRANSLATIONS.ru.categories.UDI.subtitle);
    expect(subtitle.props.numberOfLines).toBe(2);
    expect(subtitle.props.adjustsFontSizeToFit).toBe(true);
  });

  it("Android : nom d'un seul mot sur deux lignes avec césure (minimumFontScale y est ignoré)", async () => {
    const os = Platform.OS;
    Platform.OS = "android";
    try {
      setLanguagePreference("id");
      await render(<MatrixGrid tasks={[]} onOpenQuadrant={() => {}} />);
      const name = screen.getByText("Delegasikan");
      expect(name.props.numberOfLines).toBe(2);
      expect(name.props.android_hyphenationFrequency).toBe("full");
      expect(name.props.adjustsFontSizeToFit).toBe(true);
    } finally {
      Platform.OS = os;
    }
  });
});

const { readFileSync } = require("fs") as { readFileSync: (path: string) => Uint8Array };

// Caractères d'une police TrueType et leur largeur en em (tables cmap formats 4 et 12, head, hhea, hmtx)
function fontAdvances(path: string): Map<number, number> {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => view.getUint16(o);
  const u32 = (o: number) => view.getUint32(o);
  const tables = new Map<string, number>();
  for (let i = 0; i < u16(4); i++) {
    const tag = String.fromCharCode(...bytes.subarray(12 + 16 * i, 16 + 16 * i));
    tables.set(tag, u32(20 + 16 * i));
  }
  const unitsPerEm = u16(tables.get("head")! + 18);
  const metrics = u16(tables.get("hhea")! + 34);
  const hmtx = tables.get("hmtx")!;
  const advance = (glyph: number) => u16(hmtx + 4 * Math.min(glyph, metrics - 1)) / unitsPerEm;

  const cmap = tables.get("cmap")!;
  const chars = new Map<number, number>();
  for (let i = 0; i < u16(cmap + 2); i++) {
    const table = cmap + u32(cmap + 8 + 8 * i);
    const format = u16(table);
    if (format === 4) {
      const segments = u16(table + 6) / 2;
      const ends = table + 14;
      const starts = ends + 2 * segments + 2;
      const deltas = starts + 2 * segments;
      const rangeOffsets = deltas + 2 * segments;
      for (let s = 0; s < segments; s++) {
        const delta = u16(deltas + 2 * s);
        const rangeOffset = u16(rangeOffsets + 2 * s);
        for (let c = u16(starts + 2 * s); c <= u16(ends + 2 * s) && c !== 0xffff; c++) {
          let glyph = c;
          if (rangeOffset !== 0) {
            glyph = u16(rangeOffsets + 2 * s + rangeOffset + 2 * (c - u16(starts + 2 * s)));
            if (glyph === 0) continue;
          }
          chars.set(c, advance((glyph + delta) & 0xffff));
        }
      }
    } else if (format === 12) {
      for (let g = 0; g < u32(table + 12); g++) {
        const start = u32(table + 16 + 12 * g);
        const end = u32(table + 20 + 12 * g);
        const first = u32(table + 24 + 12 * g);
        for (let c = start; c <= end; c++) chars.set(c, advance(first + c - start));
      }
    }
  }
  return chars;
}
const fontCharacters = (path: string) => new Set(fontAdvances(path).keys());

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

// Android : textes étroits sur deux lignes avec césure, réduits seulement en dernier recours.
// minimumFontScale y étant ignoré, on vérifie ici, avec les largeurs réelles de Manrope, qu'aucun
// texte ne descend sous une taille lisible sur un écran de 360 dp. La réduction garde la plus
// grande taille qui tient : une police du téléphone agrandie ne la fait pas descendre plus bas.
describe("Android : textes longs lisibles sur un petit écran", () => {
  const advances = (weight: string) =>
    fontAdvances(`node_modules/@expo-google-fonts/manrope/${weight}/Manrope_${weight}.ttf`);
  const extrabold = advances("800ExtraBold");
  const bold = advances("700Bold");
  const semibold = advances("600SemiBold");
  const medium = advances("500Medium");

  // Caractère absent de Manrope : police système, ~0,6 em en devanagari, ~1 em en japonais,
  // coréen et chinois ; coupure possible entre deux caractères sans trait d'union
  const systemAdvance = (code: number) => (code >= 0x0900 && code <= 0x097f ? 0.6 : 1);
  const linesNeeded = (text: string, width: number, size: number, font: Map<number, number>) => {
    const advance = (c: string) => {
      const code = c.codePointAt(0)!;
      return (font.get(code) ?? systemAdvance(code)) * size;
    };
    const hyphen = advance("-");
    const space = advance(" ");
    let lines = 1;
    let x = 0;
    for (const word of text.split(/\s+/)) {
      const wordWidth = [...word].reduce((sum, c) => sum + advance(c), 0);
      const gap = x > 0 ? space : 0;
      if (x + gap + wordWidth <= width) {
        x += gap + wordWidth;
      } else if (wordWidth <= width) {
        lines++;
        x = wordWidth;
      } else {
        // Mot plus long que la ligne : coupé avec un trait d'union (« Delega- / sikan »)
        x += gap;
        for (const c of word) {
          const cut = font.has(c.codePointAt(0)!) ? hyphen : 0;
          if (x + advance(c) + cut > width) {
            lines++;
            x = 0;
          }
          x += advance(c);
        }
      }
    }
    return lines;
  };

  // Taille réellement affichée : la plus grande qui tient sur deux lignes
  const shownSize = (text: string, width: number, size: number, font: Map<number, number>) => {
    let shown = size;
    while (linesNeeded(text, width, shown, font) > 2) shown -= 0.25;
    return shown;
  };

  // Largeurs utiles sur 360 dp : grille (cellule de 113 dp), présentation, action glissée, carte
  const cases = (language: Language) => {
    const x = TRANSLATIONS[language];
    const names = Object.values(x.categories).map((c) => c.name);
    const subtitles = Object.values(x.categories).map((c) => c.subtitle);
    setLanguagePreference(language);
    const due = formatDue(new Date(2026, 8, 30, 23, 45).getTime());
    return [
      ...names.map((text) => ({ where: "nom (grille)", text, width: 69, size: 17, font: extrabold, floor: 12 })),
      ...subtitles.map((text) => ({ where: "sous-titre (grille)", text, width: 113, size: 12, font: medium, floor: 10 })),
      ...names.map((text) => ({ where: "nom (présentation)", text, width: 126, size: 16, font: extrabold, floor: 12 })),
      { where: "action glissée", text: x.onboarding.swipeRight, width: 58, size: 13, font: bold, floor: 10 },
      { where: "pastille (grille)", text: due, width: 81, size: 12, font: semibold, floor: 10 },
      ...[
        x.chips.soonUrgent,
        x.chips.waitingSince(x.reminders.hoursMinutes(23, "45")),
        x.chips.nextIn(x.reminders.hoursMinutes(23, "45")),
        x.chips.nagCount(3, 3),
        x.reminders.nagLabel(x.reminders.oneDay, true),
        x.reminders.followUpLabel(x.reminders.inThreeDays),
      ].map((text) => ({ where: "pastille (carte)", text, width: 210, size: 12, font: semibold, floor: 10 })),
    ];
  };

  it("ru : « Когда-нибудь » presque à taille normale dans la grille (« Если будет время » descendait à 12,4 dp)", () => {
    expect(TRANSLATIONS.ru.categories.NDNI.name).toBe("Когда-нибудь");
    expect(shownSize("Когда-нибудь", 69, 17, extrabold)).toBeGreaterThanOrEqual(16.5);
    expect(shownSize("Если будет время", 69, 17, extrabold)).toBeLessThan(13);
  });

  it.each(LANGUAGES)("%s : rien sous la taille plancher", (language) => {
    const tooSmall = cases(language)
      .map((c) => ({ ...c, shown: shownSize(c.text, c.width, c.size, c.font) }))
      .filter((c) => c.shown < c.floor)
      .map((c) => `${c.where} « ${c.text} » : ${c.shown} dp`);
    expect(tooSmall).toEqual([]);
  });
});
