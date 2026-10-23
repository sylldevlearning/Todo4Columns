// Android : les 5 graisses de Manrope sont intégrées au build par le plugin expo-font
// (app.json), sous leur nom de fichier (Manrope_400Regular…) : rien à charger au lancement
export function useAppFonts(): boolean {
  return true;
}
