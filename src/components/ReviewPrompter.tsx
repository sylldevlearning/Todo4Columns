import * as StoreReview from "expo-store-review";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useCelebration } from "../celebration/CelebrationProvider";
import { Completion } from "../completionLog";
import { isForeground } from "../hooks/useTasks";
import {
  canAskForReview,
  clearReviewPrompt,
  estimateFirstUse,
  getLastUndoAt,
  requestReviewPrompt,
  REVIEW_DELAY_MS,
  REVIEW_TASKS_DONE,
  ReviewTrigger,
  reviewRequests,
} from "../reviewPrompt";
import { useStoreSelector } from "../store/selectableStore";
import { TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";

// Nouvel essai tant qu'une célébration est à l'écran
const RETRY_MS = 500;
// Une fin de tâche plus ancienne vient du chargement ou d'un import, pas de l'utilisateur
const LIVE_COMPLETION_MS = 5 * 1000;

const selectCompletions = ({ completions }: TasksState) => completions;
const identity = (trigger: ReviewTrigger | null) => trigger;

// Demande d'avis : après la fin d'une revue ou une tâche terminée (dès la 10e), une fois la
// célébration finie et si les conditions de temps sont remplies. Rien n'est affiché par l'app.
export default function ReviewPrompter() {
  const completions = useTasksSelector(selectCompletions);
  const trigger = useStoreSelector(reviewRequests, identity);
  const actions = useTaskActions();
  const { isCelebrating } = useCelebration();
  const previous = useRef<Completion[] | null>(null);

  // Tâche terminée à l'instant (le journal vient de gagner une entrée récente)
  useEffect(() => {
    const before = previous.current;
    previous.current = completions;
    if (before === null || completions.length <= before.length) return;
    const last = completions[completions.length - 1];
    if (Date.now() - last.date > LIVE_COMPLETION_MS) return;
    if (completions.length >= REVIEW_TASKS_DONE) requestReviewPrompt("tasksDone");
  }, [completions]);

  useEffect(() => {
    if (trigger === null) return;
    const check = () => {
      if (isCelebrating()) {
        timeout = setTimeout(check, RETRY_MS);
        return;
      }
      clearReviewPrompt();
      if (isForeground(AppState.currentState)) {
        askForReview(trigger).catch((e) => console.warn("Demande d'avis impossible :", e));
      }
    };
    let timeout = setTimeout(check, REVIEW_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [trigger]);

  const askForReview = async (trigger: ReviewTrigger) => {
    const now = Date.now();
    const settings = actions.getSettings();
    const { tasks, completions } = actions.getTasksState();
    // Tâche rouverte entre-temps : moins de 10 fins de tâches
    if (trigger === "tasksDone" && completions.length < REVIEW_TASKS_DONE) return;
    const firstUseAt = settings.firstUseAt ?? estimateFirstUse(tasks, completions, now);
    const dates = { firstUseAt, reviewAskedAt: settings.reviewAskedAt, lastUndoAt: getLastUndoAt() };
    if (!canAskForReview(dates, now) || !(await StoreReview.isAvailableAsync())) {
      // Première utilisation retenue pour les prochaines fois
      if (settings.firstUseAt === undefined) actions.updateSettings({ ...actions.getSettings(), firstUseAt });
      return;
    }
    actions.updateSettings({ ...actions.getSettings(), firstUseAt, reviewAskedAt: now });
    await StoreReview.requestReview();
  };

  return null;
}
