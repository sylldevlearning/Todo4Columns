import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { getPermissionDetails, PermissionState } from "./setup";

// État de l'autorisation des notifications, relu à chaque retour dans l'app
// (l'utilisateur a pu la changer dans les réglages du téléphone). canAskAgain faux : la
// fenêtre système ne s'affiche plus, seuls les réglages du téléphone permettent d'autoriser.
export function usePermissionState(): [PermissionState | null, () => void, boolean] {
  const [state, setState] = useState<PermissionState | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const refresh = useCallback(() => {
    getPermissionDetails()
      .then((details) => {
        setState(details.state);
        setCanAskAgain(details.canAskAgain);
      })
      .catch(() => setState(null));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return [state, refresh, canAskAgain];
}
