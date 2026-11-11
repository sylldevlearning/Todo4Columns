import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadLog, logEntry, pruneLog, seedLog, updateLog } from "../completionLog";
import { markDoneIn } from "../hooks/useRecurrence";
import { setLanguagePreference } from "../i18n";
import { serializeTasks } from "../migrations";
import { defaultNotifier, Notifier } from "../notifications/service";
import { loadSettings } from "../settings";
import { stepsOf, toggleStepIn } from "../steps";
import { loadTasksForUpdate, STORAGE_KEY } from "../storage";
import { withTasksLock } from "../tasksLock";
import {
  loadTombstones,
  noteLogAddition,
  noteLogRemoval,
  stampChanges,
  syncMarksEntry,
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

// Attente maximale d'une app enregistrée mais pas encore prête (tâches en cours de lecture)
export const LIVE_APP_WAIT_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// L'app est-elle (ou devient-elle, en quelques secondes) prête à recevoir la coche ?
async function readyLiveApp() {
  const live = getLiveApp();
  if (!live) return null;
  for (let waited = 0; !live.isReady() && waited < LIVE_APP_WAIT_MS; waited += 50) await sleep(50);
  return live.isReady() ? live : null;
}

// Coche depuis un widget, comme dans l'app : tâche terminée (occurrence suivante d'une tâche
// récurrente comprise) ou étape cochée, journal des fins, rappels annulés ou reprogrammés,
// modification notée pour la synchronisation (modifiedAt).
// - App ouverte, ou en train de lire ses tâches : ses propres actions (la synchronisation suit
//   d'elle-même).
// - App fermée : sur les données enregistrées, sous verrou (le chargement des tâches par l'app
//   attend la fin de l'écriture, et les coches passent l'une après l'autre, chacune relisant les
//   données) ; la synchronisation se fera à la prochaine ouverture.
export async function checkFromWidget(
  { taskId, stepId }: WidgetCheck,
  notifier: Notifier = defaultNotifier
): Promise<CheckResult> {
  const live = await readyLiveApp();
  if (live) {
    if (stepId) live.completeStep(taskId, stepId);
    else live.completeTask(taskId);
    return "live";
  }
  return withTasksLock(() => checkStored({ taskId, stepId }, notifier));
}

async function checkStored({ taskId, stepId }: WidgetCheck, notifier: Notifier): Promise<CheckResult> {
  await loadTombstones();
  // Comme au lancement de l'app : ancien format migré, copie brute gardée avant
  const before = await loadTasksForUpdate();
  if (before === null) return "unchanged";
  const settings = await loadSettings();
  setLanguagePreference(settings.language); // textes des rappels reprogrammés
  const now = Date.now();
  // Tâche déjà terminée (double appui) ou étape déjà cochée : rien ne change
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

  // Une seule écriture : tâches, journal et suppressions ensemble, ou rien
  await AsyncStorage.multiSet([[STORAGE_KEY, serializeTasks(final)], logEntry(log), syncMarksEntry()]);
  return "saved";
}
