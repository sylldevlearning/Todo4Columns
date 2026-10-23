import appJson from "../../app.json";
import { useAppFonts } from "../fonts.android";
import { fonts } from "../theme";

// Polices déclarées au plugin expo-font pour Android
const androidFonts = (): string[] => {
  const plugin = (appJson.expo.plugins as unknown[]).find(
    (p) => Array.isArray(p) && p[0] === "expo-font"
  ) as [string, { android?: { fonts?: string[] } }] | undefined;
  return plugin?.[1].android?.fonts ?? [];
};

const baseName = (file: string) => file.split("/").pop()!.replace(/\.ttf$/, "");

describe("polices intégrées au build Android", () => {
  it("chaque famille des styles correspond à un fichier déclaré, sous le même nom", () => {
    expect(androidFonts().map(baseName).sort()).toEqual(Object.values(fonts).sort());
  });

  it("les fichiers viennent des 5 graisses de @expo-google-fonts/manrope", () => {
    for (const file of androidFonts()) {
      const family = baseName(file);
      const weight = family.replace("Manrope_", "");
      expect(file).toBe(`./node_modules/@expo-google-fonts/manrope/${weight}/${family}.ttf`);
    }
  });

  it("rien n'est chargé au lancement sur Android", () => {
    expect(useAppFonts()).toBe(true);
  });
});
