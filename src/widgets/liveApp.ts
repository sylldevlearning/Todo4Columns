// L'app est-elle ouverte (même en arrière-plan) avec ses tâches chargées ? Le gestionnaire des
// widgets tourne alors dans le même moteur JavaScript : une coche depuis un widget doit passer par
// les actions de l'app (sinon l'état en mémoire, plus ancien, écraserait la modification à son
// prochain enregistrement). Renseigné par WidgetSync (src/widgets/WidgetSync.tsx).

export interface LiveApp {
  isReady: () => boolean; // tâches lues sans erreur
  completeTask: (id: string) => void;
  completeStep: (taskId: string, stepId: string) => void;
}

let live: LiveApp | null = null;

export const setLiveApp = (app: LiveApp | null) => {
  live = app;
};
export const getLiveApp = () => live;
