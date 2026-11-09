import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadLog, pruneLog, saveLog, seedLog, updateLog } from "../completionLog";
import { markDoneIn } from "../hooks/useRecurrence";
import { setLanguagePreference } from "../i18n";
import { parseStoredTasks } from "../migrations";
import { defaultNotifier, Notifier } from "../notifications/service";
import { loadSettings } from "../settings";
import { stepsOf, toggleStepIn } from "../steps";
import { saveTasks, STORAGE_KEY } from "../storage";
import {
  loadTombstones,
  noteLogAddition,
  noteLogRemoval,
  persistSyncMarks,
  stampChanges,
} from "../sync/localChanges";
import { Task } from "../types";
import { getLiveApp } from "./liveApp";

export interface WidgetCheck {
  taskId: string;
  stepId: string | null; // étape prévue aujourd'hui (« Aujourd'hui »), sinon la tâche
}

export type CheckResult = "live" | "saved" | "unchanged";

// Coche une étape non faite (comme « Fait » dans le rappel d'une étape)
const completeStepIn = (tasks: Task[], taskId: string, stepId: string, now: number): Task[] =>
  tasks.map((t) =>
    t.id === taskId && stepsOf(t).some((s) => s.id === stepId && !s.done)
      ? { ...t, steps: toggleStepIn(stepsOf(t), stepId, now) }
      : t
  );

// Coche depuis un widget, comme dans l'app : tâche terminée (occurrence suivante d'une tâche
// récurrente comprise) ou étape cochée, journal des fins, rappels annulés ou reprogrammés,
// modification notée pour la synchronisation (modifiedAt).
// - App ouverte : ses propres actions (la synchronisation suit d'elle-même).
// - App fermée : sur les données enregistrées ; la synchronisation se fera à la prochaine ouverture.
export async function checkFromWidget(
  { taskId, stepId }: WidgetCheck,
  notifier: Notifier = defaultNotifier
): Promise<CheckResult> {
  const live = getLiveApp();
  if (live?.isReady()) {
    if (stepId) live.completeStep(taskId, stepId);
    else live.completeTask(taskId);
    return "live";
  }

  await loadTombstones();
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (json === null) return "unchanged";
  const before = parseStoredTasks(json).tasks;
  const settings = await loadSettings();
  setLanguagePreference(settings.language); // textes des rappels reprogrammés
  const now = Date.now();
  const changed = stepId ? completeStepIn(before, taskId, stepId, now) : markDoneIn(before, taskId, now, settings);
  if (changed === before || changed.every((t, i) => t === before[i])) return "unchanged";
  const stamped = stampChanges(before, changed, now);

  // Journal des fins (et retrait noté pour la synchronisation, comme dans l'app)
  const saved = await loadLog();
  const log = pruneLog(
    updateLog(saved ?? seedLog(before, now), before, stamped, {
      onRemoved: (key) => noteLogRemoval(key, now),
      onAdded: noteLogAddition,
    }),
    now
  );

  // Rappels des tâches modifiées ou ajoutées : annulés pour la tâche terminée, programmés pour
  // l'occurrence suivante
  const previous = new Map(before.map((t) => [t.id, t]));
  const final: Task[] = [];
  for (const task of stamped) {
    if (previous.get(task.id) === task) {
      final.push(task);
      continue;
    }
    let ids: string[] = [];
    try {
      ids = await notifier.syncTask(task, settings, now);
    } catch (e) {
      console.warn("Rappels après une coche depuis le widget :", e);
    }
    final.push({ ...task, notificationIds: ids });
  }

  await saveTasks(final);
  await saveLog(log);
  await persistSyncMarks();
  return "saved";
}
