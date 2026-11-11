// Verrou sur les tâches enregistrées, dans le moteur JavaScript de l'app : une coche depuis un
// widget (app fermée) le prend pendant sa lecture et son écriture ; le chargement des tâches par
// l'app l'attend, pour lire après cette écriture (jamais avant, sinon il l'écraserait). Les
// coches passent aussi l'une après l'autre (double appui).

let tail: Promise<unknown> = Promise.resolve();

// Exécute work quand le verrou est libre ; les suivants attendent sa fin (réussie ou non)
export function withTasksLock<T>(work: () => Promise<T>): Promise<T> {
  const run = tail.then(work, work);
  tail = run.catch(() => {});
  return run;
}

// Attend la fin des écritures en cours (chargement des tâches par l'app)
export const waitForTasksLock = (): Promise<void> => tail.then(() => {});
