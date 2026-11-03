import { Platform, TextProps } from "react-native";

// Texte traduit dans une place étroite (nom de quadrant, pastille, action) : jamais coupé.
// - iOS : `lines` lignes, réduit au besoin jusqu'à minimumFontScale.
// - Android : minimumFontScale y est ignoré (la réduction descendrait jusqu'à 4 dp). Deux lignes
//   avec césure ; la réduction ne sert qu'en dernier recours et garde la plus grande taille qui
//   tient, quelle que soit la police du téléphone (taille plancher vérifiée par les tests).
export function fitText(lines: number, minimumFontScale: number): TextProps {
  return Platform.OS === "android"
    ? { numberOfLines: Math.max(lines, 2), android_hyphenationFrequency: "full", adjustsFontSizeToFit: true }
    : { numberOfLines: lines, adjustsFontSizeToFit: true, minimumFontScale };
}
