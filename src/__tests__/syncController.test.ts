import AsyncStorage from "@react-native-async-storage/async-storage";
import { resetDriveStateForTests, updateDriveState } from "../drive/driveBackup";
import {
  configureSync,
  flushSync,
  getSyncStatus,
  MIN_OPEN_INTERVAL,
  pauseSync,
  resetSyncControllerForTests,
  RETRY_DELAYS,
  scheduleSync,
  SYNC_DEBOUNCE_MS,
  syncNow,
  syncOnOpen,
} from "../sync/controller";
import { DEFAULT_SYNC_STATE, LocalSide, StateStore, SyncState } from "../sync/engine";
import { EMPTY_SYNC_DATA, mergeData, SyncData } from "../sync/merge";
import { driveRemote } from "../sync/remote";
import { DEFAULT_SETTINGS } from "../settings";
import { createFakeDrive, FakeDrive } from "../testing/fakeDrive";
import { makeTask } from "../testing/makeTask";

// Déclencheurs de la synchronisation : 10 s après le dernier changement, arrière-plan, retour
// dans l'app, nouvel essai après un échec, sans message.

jest.mock("../drive/googleAccount", () => ({
  ...jest.requireActual("../drive/googleAccount"),
  accessToken: jest.fn(async () => "jeton"),
  discardToken: jest.fn(async () => {}),
}));

let fake: FakeDrive;
let data: SyncData;
let state: SyncState;
const store: StateStore = {
  load: async () => state,
  save: async (s) => {
    state = s;
  },
};
const local: LocalSide = {
  read: async () => ({ data, settings: DEFAULT_SETTINGS }),
  apply: async (d, { replace }) => {
    data = replace ? d : mergeData(data, d, Date.now());
  },
};
const writes = () => fake.state.requests.filter((r) => r.method === "POST" || r.method === "PATCH").length;
const change = (id: string) => {
  data = { ...data, tasks: [...data.tasks, makeTask({ id, modifiedAt: Date.now() })] };
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 9, 0) });
  await AsyncStorage.clear();
  resetDriveStateForTests();
  resetSyncControllerForTests();
  fake = createFakeDrive();
  globalThis.fetch = fake.fetch as unknown as typeof fetch;
  data = { ...EMPTY_SYNC_DATA };
  state = { ...DEFAULT_SYNC_STATE };
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await updateDriveState({ account: "lea@example.com", autoBackup: true });
  await configureSync({ remote: driveRemote, store, local, canSync: () => true });
});
afterEach(() => {
  resetSyncControllerForTests();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("10 s après le dernier changement : une seule synchronisation pour une série de changements", async () => {
  await syncNow();
  const before = writes();
  change("a");
  scheduleSync();
  await jest.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS - 1000);
  change("b");
  scheduleSync(); // le délai repart
  await jest.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS - 1000);
  expect(writes()).toBe(before);
  await jest.advanceTimersByTimeAsync(1000);
  expect(writes()).toBe(before + 1);
});

it("rien n'a changé : le déclencheur différé ne fait aucune requête", async () => {
  change("a");
  await syncNow();
  fake.state.requests = [];
  scheduleSync();
  await jest.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
  expect(fake.state.requests).toEqual([]);
});

it("passage en arrière-plan : les changements en attente partent tout de suite", async () => {
  await syncNow();
  change("a");
  scheduleSync();
  const before = writes();
  await flushSync();
  expect(writes()).toBe(before + 1);
  // Le déclencheur différé est annulé
  await jest.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
  expect(writes()).toBe(before + 1);
});

it("retour dans l'app : au plus une synchronisation toutes les 30 s", async () => {
  await syncNow();
  expect(syncOnOpen()).toBeNull();
  await jest.advanceTimersByTimeAsync(MIN_OPEN_INTERVAL);
  expect(syncOnOpen()).not.toBeNull();
});

it("hors ligne : état « hors ligne », nouvel essai après 30 s, puis 2 min ; au retour du réseau tout part", async () => {
  fake.state.offline = true;
  change("a");
  const outcome = await syncNow();
  expect(outcome).toEqual({ ok: false, error: "offline" });
  expect(getSyncStatus().phase).toBe("offline");
  const attempts = () => fake.state.requests.length;
  const first = attempts();
  await jest.advanceTimersByTimeAsync(RETRY_DELAYS[0]);
  expect(attempts()).toBe(first + 1);
  await jest.advanceTimersByTimeAsync(RETRY_DELAYS[0]);
  expect(attempts()).toBe(first + 1); // le délai suivant est plus long
  fake.state.offline = false;
  await jest.advanceTimersByTimeAsync(RETRY_DELAYS[1]);
  expect(getSyncStatus().phase).toBe("idle");
  expect(getSyncStatus().lastSyncAt).not.toBeNull();
  expect(writes()).toBeGreaterThan(0);
});

it("synchronisation automatique coupée : seules les demandes de l'utilisateur passent", async () => {
  await updateDriveState({ autoBackup: false });
  change("a");
  expect(await syncNow()).toEqual({ ok: true, result: null });
  expect(fake.state.requests).toEqual([]);
  expect((await syncNow({ manual: true })).ok).toBe(true);
  expect(writes()).toBeGreaterThan(0);
});

it("choix en attente à la connexion : rien d'automatique", async () => {
  pauseSync(true);
  change("a");
  await syncNow();
  scheduleSync();
  await jest.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
  expect(fake.state.requests).toEqual([]);
  pauseSync(false);
});

it("demandes simultanées : une seule synchronisation à la fois, la suivante regroupée", async () => {
  change("a");
  const first = syncNow();
  change("b");
  const second = syncNow();
  await Promise.all([first, second]);
  await jest.advanceTimersByTimeAsync(0);
  const parsed = fake.filesNamed("dofirst-sync.json");
  expect(parsed).toHaveLength(1);
  expect(fake.contentOf(parsed[0])).toContain('"id":"b"');
});

it("non connecté : rien n'est fait", async () => {
  await updateDriveState({ account: null });
  change("a");
  await syncNow({ manual: true });
  expect(fake.state.requests).toEqual([]);
  expect(getSyncStatus().phase).toBe("off");
});
