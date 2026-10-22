import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseStoredTasks,
  serializeTasks,
  TASKS_SCHEMA_VERSION,
} from "./migrations";
import { Task } from "./types";

// Clé de stockage : NE PAS MODIFIER, sinon les tâches existantes ne seront plus retrouvées
export const STORAGE_KEY = "TASKS_4COLS";
// Copie d'un ancien format, écrite une seule fois avant de le migrer
export const backupKeyFor = (version: number) => `TASKS_4COLS_BACKUP_V${version}`;
export const BACKUP_V1_KEY = backupKeyFor(1);
// Préfixe des copies de contenus illisibles
export const CORRUPT_BACKUP_PREFIX = "TASKS_4COLS_CORRUPT_";

// Charge les tâches en migrant l'ancien format si besoin.
// Une erreur de lecture d'AsyncStorage est propagée : l'appelant ne doit alors rien sauvegarder.
export async function loadTasks(): Promise<Task[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);

  let parsed;
  try {
    parsed = parseStoredTasks(json);
  } catch (e) {
    // Contenu illisible : on le met de côté avant qu'il soit remplacé
    console.warn("Tâches illisibles, copie de sauvegarde conservée :", e);
    await AsyncStorage.setItem(`${CORRUPT_BACKUP_PREFIX}${Date.now()}`, json ?? "");
    return [];
  }

  if (
    json !== null &&
    parsed.fromVersion !== null &&
    parsed.fromVersion < TASKS_SCHEMA_VERSION &&
    (await AsyncStorage.getItem(backupKeyFor(parsed.fromVersion))) === null
  ) {
    await AsyncStorage.setItem(backupKeyFor(parsed.fromVersion), json);
  }
  return parsed.tasks;
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(tasks));
}
