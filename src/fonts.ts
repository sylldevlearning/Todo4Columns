// iOS et web : les graisses de Manrope sont chargées au lancement.
// Sur Android, elles sont intégrées au build (fonts.android.ts).
// Une importation par graisse : l'index du paquet référence aussi ExtraLight et Light
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Manrope_800ExtraBold } from "@expo-google-fonts/manrope/800ExtraBold";
import { useFonts } from "expo-font";

// true quand l'app peut s'afficher (polices prêtes, ou en échec : police système)
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  return loaded || error !== null;
}
