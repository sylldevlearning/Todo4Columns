import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

// Compte Google pour la sauvegarde Drive (facultative).
//
// Seul le scope drive.appdata est demandé : DoFirst ne voit que son propre dossier caché du Drive
// (appDataFolder), jamais les fichiers de l'utilisateur. Les jetons restent dans la librairie
// (Google Sign-In natif) : ils ne sont ni enregistrés par l'app ni écrits dans les journaux.
export const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// Sauvegarde Drive disponible : Android seulement (iOS n'a pas de client OAuth configuré)
export const isDriveAvailable = () => Platform.OS === "android";

// Accès refusé ou retiré : l'utilisateur doit se reconnecter
export class NotSignedInError extends Error {}

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ scopes: [DRIVE_APPDATA_SCOPE] });
  configured = true;
}

// Fenêtre de connexion Google ; e-mail du compte, ou null si l'utilisateur annule
export async function signIn(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    // Scope refusé dans la fenêtre de consentement : pas d'accès au Drive
    const scopes = response.data.scopes ?? [];
    if (scopes.length > 0 && !scopes.includes(DRIVE_APPDATA_SCOPE)) {
      await GoogleSignin.signOut().catch(() => {});
      throw new NotSignedInError("Scope drive.appdata refusé");
    }
    return response.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return null;
    }
    throw e;
  }
}

// Session Google restaurée sans fenêtre (après un redémarrage de l'app)
async function ensureSignedIn(): Promise<void> {
  configure();
  if (GoogleSignin.getCurrentUser()) return;
  const response = await GoogleSignin.signInSilently();
  if (isNoSavedCredentialFoundResponse(response)) throw new NotSignedInError("Aucune session Google");
}

// Jeton d'accès courant (renouvelé par la librairie si besoin)
export async function accessToken(): Promise<string> {
  try {
    await ensureSignedIn();
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (e) {
    if (e instanceof NotSignedInError) throw e;
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED) throw new NotSignedInError("Session expirée");
    throw e;
  }
}

// Jeton refusé par Drive (401) : retiré du cache pour que le suivant soit neuf
export async function discardToken(token: string): Promise<void> {
  await GoogleSignin.clearCachedAccessToken(token).catch(() => {});
}

// Déconnexion : la librairie oublie le compte et ses jetons
export async function signOut(): Promise<void> {
  configure();
  await GoogleSignin.signOut();
}
