import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { shareMessage } from "./delegation";
import { t } from "./i18n";
import { showAlert } from "./appWindows";

// Réglages › À propos : noter, partager, écrire au développeur

export const ANDROID_PACKAGE = "com.saloum.sylla.matriceeisenhower";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
// Fiche dans l'app Play Store (repli sur la page web si elle n'est pas installée)
const PLAY_STORE_APP_URL = `market://details?id=${ANDROID_PACKAGE}`;
// Adresse des suggestions et des signalements (aussi dans store/privacy-policy-*.md)
export const FEEDBACK_EMAIL = "sylldevlearning@gmail.com";

// Version de l'app (app.json), ex. « 1.2.1 »
export const appVersion = (): string => Constants.expoConfig?.version ?? "?";

// Version du système, ex. « Android 14 (API 34) »
export function systemVersion(): string {
  if (Platform.OS === "android") {
    const release = (Platform.constants as { Release?: string }).Release;
    return release ? `Android ${release} (API ${Platform.Version})` : `Android (API ${Platform.Version})`;
  }
  return `${Platform.OS} ${Platform.Version}`;
}

// « Noter DoFirst » : fiche Play Store
export function openStoreListing(): void {
  Linking.openURL(PLAY_STORE_APP_URL).catch(() =>
    Linking.openURL(PLAY_STORE_URL).catch((e) => console.warn("Fiche Play Store impossible :", e))
  );
}

// « Partager DoFirst » : partage natif avec un court message et le lien
export const shareApp = () => shareMessage(t.about.shareMessage(PLAY_STORE_URL));

// E-mail prérempli : objet, versions de l'app et du système dans le corps
export const feedbackMailUrl = () =>
  `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t.about.feedbackSubject)}&body=${encodeURIComponent(
    t.about.feedbackBody(appVersion(), systemVersion())
  )}`;

// « Suggérer une idée / signaler un problème » ; sans app de messagerie, l'adresse est affichée
export function sendFeedback(): void {
  Linking.openURL(feedbackMailUrl()).catch(() =>
    showAlert(t.about.noMailTitle, t.about.noMailBody(FEEDBACK_EMAIL))
  );
}
