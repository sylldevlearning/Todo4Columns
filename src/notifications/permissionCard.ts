import { createSelectableStore, useStoreSelector } from "../store/selectableStore";

// Carte « Les notifications sont désactivées » : affichée quand l'utilisateur active un rappel
// alors que l'autorisation est refusée et qu'Android ne peut plus afficher sa fenêtre
const cardStore = createSelectableStore(false);
const identity = (visible: boolean) => visible;

export const showPermissionCard = () => cardStore.set(true);
export const hidePermissionCard = () => cardStore.set(false);
export const isPermissionCardVisible = () => cardStore.get();
export const usePermissionCardVisible = () => useStoreSelector(cardStore, identity);
