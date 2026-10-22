import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { getPermissionState, PermissionState } from "./setup";

// État de l'autorisation des notifications, relu à chaque retour dans l'app
// (l'utilisateur a pu la changer dans les réglages du téléphone)
export function usePermissionState(): [PermissionState | null, () => void] {
  const [state, setState] = useState<PermissionState | null>(null);

  const refresh = useCallback(() => {
    getPermissionState()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return [state, refresh];
}
