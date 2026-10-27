import { Completion } from "./completionLog";
import { createSelectableStore } from "./store/selectableStore";
import { Task } from "./types";

// Demande d'avis dans l'app (fenêtre officielle du Play Store, sans quitter l'app)

const DAY_MS = 24 * 60 * 60 * 1000;
// Jamais pendant les premiers jours d'utilisation
export const REVIEW_MIN_DAYS = 3;
// Au plus une demande sur cette période
export const REVIEW_INTERVAL_DAYS = 90;
// Tâches terminées avant de demander (journal des fins de tâches)
export const REVIEW_TASKS_DONE = 10;
// Après un « Annuler », aucune demande pendant ce délai
export const UNDO_GRACE_MS = 30 * 1000;
// Attente avant de demander : le bandeau « Annuler » (5 s) a disparu
export const REVIEW_DELAY_MS = 6 * 1000;

export type ReviewTrigger = "weeklyReview" | "tasksDone";

export interface ReviewDates {
  firstUseAt: number; // première utilisation (enregistrée ou estimée)
  reviewAskedAt?: number; // dernière demande d'avis
  lastUndoAt: number | null; // dernier « Annuler »
}

// Toutes les conditions de temps sont remplies
export const canAskForReview = ({ firstUseAt, reviewAskedAt, lastUndoAt }: ReviewDates, now: number) =>
  now - firstUseAt >= REVIEW_MIN_DAYS * DAY_MS &&
  (reviewAskedAt === undefined || now - reviewAskedAt >= REVIEW_INTERVAL_DAYS * DAY_MS) &&
  (lastUndoAt === null || now - lastUndoAt >= UNDO_GRACE_MS);

// Dates plus anciennes ignorées : identifiants numériques des tout premiers formats pris pour des
// dates (« 1 » donnerait 1970 et la règle des 3 jours sauterait)
export const OLDEST_PLAUSIBLE_DATE = new Date(2020, 0, 1).getTime();

// Première utilisation pas encore enregistrée (réglages d'avant la 1.2.1) : la plus ancienne
// tâche ou fin de tâche connue
export const estimateFirstUse = (tasks: Task[], completions: Completion[], now: number) =>
  Math.min(
    now,
    ...tasks.map((t) => t.createdAt).filter((date) => date >= OLDEST_PLAUSIBLE_DATE),
    ...completions.map((c) => c.date)
  );

// ---- Demandes en attente et derniers « Annuler » ----
const pending = createSelectableStore<ReviewTrigger | null>(null);
let lastUndoAt: number | null = null;

export const reviewRequests = pending;

// Fin d'une revue, tâche terminée : la demande est examinée un peu plus tard
export const requestReviewPrompt = (trigger: ReviewTrigger) => pending.set(trigger);
export const clearReviewPrompt = () => pending.set(null);

// À appeler à chaque « Annuler » (tâche, bascule, import)
export const noteUndo = (now: number = Date.now()) => {
  lastUndoAt = now;
};
export const getLastUndoAt = () => lastUndoAt;
