// Première synchronisation après le lancement : certains changements automatiques (archivage)
// l'attendent quand un compte Google Drive est connecté, pour que les versions reçues des autres
// téléphones passent avant.

// Délai maximal d'attente (hors ligne lent, journal illisible…)
export const FIRST_SYNC_TIMEOUT_MS = 20 * 1000;

let done = false;
let waiters: (() => void)[] = [];
// Renseigné par le pilote de la synchronisation : une première synchronisation est-elle attendue ?
let expected: (() => Promise<boolean>) | null = null;

export function expectFirstSync(check: (() => Promise<boolean>) | null): void {
  expected = check;
}

export function markFirstSyncDone(): void {
  done = true;
  const pending = waiters;
  waiters = [];
  pending.forEach((resolve) => resolve());
}

export async function waitForFirstSync(timeoutMs: number = FIRST_SYNC_TIMEOUT_MS): Promise<void> {
  if (done || expected === null) return;
  if (!(await expected().catch(() => false)) || done) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(finish, timeoutMs);
    function finish() {
      clearTimeout(timer);
      waiters = waiters.filter((w) => w !== finish);
      resolve();
    }
    waiters.push(finish);
  });
}

// Tests : tout oublier
export function resetFirstSyncForTests(): void {
  done = false;
  waiters = [];
  expected = null;
}
