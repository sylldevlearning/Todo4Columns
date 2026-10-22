import AsyncStorage from "@react-native-async-storage/async-storage";
import { Task } from "./types";

// Clé de stockage : NE PAS MODIFIER, sinon les tâches existantes ne seront plus retrouvées
const STORAGE_KEY = "TASKS_4COLS";

export async function loadTasks(): Promise<Task[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  return json ? (JSON.parse(json) as Task[]) : [];
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
