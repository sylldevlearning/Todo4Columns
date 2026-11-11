import { buildBackup } from "../backup";
import { DRIVE_FILE_PREFIX } from "../drive/driveBackup";
import { createLocalSide } from "../sync/controller";
import { DEFAULT_SYNC_STATE, LocalSide, StateStore, syncOnce, SyncMode, SyncState } from "../sync/engine";
import { resetTombstonesForTests, stampChanges } from "../sync/localChanges";
import { completionKey, EMPTY_SYNC_DATA, hashData, mergeData, SyncData } from "../sync/merge";
import { driveRemote } from "../sync/remote";
import { parseSyncFile, SYNC_FILE_NAME } from "../sync/syncFile";
import { DEFAULT_SETTINGS } from "../settings";
import type { TaskActions, TasksState } from "../store/TasksContext";
import { createFakeDrive, FakeDrive } from "../testing/fakeDrive";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";

// Scénarios de la revue de la synchronisation (points 1, 2, 4, 6, 7, 9), sur deux téléphones
// simulés et un Google Drive simulé. Chacun échouait avant sa correction.

jest.mock("../drive/googleAccount", () => ({
  ...jest.requireActual("../drive/googleAccount"),
  accessToken: jest.fn(async () => "jeton"),
  discardToken: jest.fn(async () => {}),
}));

const T0 = new Date(2026, 10, 9, 9, 0).getTime();
let fake: FakeDrive;
let clock: number;
const tick = (ms = 1000) => (clock += ms);

beforeEach(() => {
  fake = createFakeDrive();
  globalThis.fetch = fake.fetch as unknown as typeof fetch;
  clock = T0;
  resetTombstonesForTests();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

class Phone {
  data: SyncData = { ...EMPTY_SYNC_DATA };
  state: SyncState = { ...DEFAULT_SYNC_STATE };
  store: StateStore = {
    load: async () => this.state,
    save: async (s) => {
      this.state = s;
    },
  };
  local: LocalSide = {
    read: async () => ({ data: this.data, settings: DEFAULT_SETTINGS }),
    apply: async (data, { replace }) => {
      this.data = replace ? data : mergeData(this.data, data, clock);
    },
  };
  sync(mode?: SyncMode) {
    return syncOnce({ remote: driveRemote, local: this.local, store: this.store, now: () => clock }, { mode });
  }
  add(id: string, extra: Partial<Task> = {}) {
    this.data = { ...this.data, tasks: [...this.data.tasks, makeTask({ id, title: id, createdAt: clock, updatedAt: clock, modifiedAt: clock, ...extra })] };
  }
  complete(id: string) {
    this.data = {
      ...this.data,
      tasks: this.data.tasks.map((t) => (t.id === id ? { ...t, isDone: true, completedAt: clock, modifiedAt: clock } : t)),
      completions: [...this.data.completions, { date: clock, category: "UI" }],
    };
  }
  task = (id: string) => this.data.tasks.find((t) => t.id === id)!;
  ids = () => this.data.tasks.map((t) => t.id).sort();
}

const remoteFile = () => {
  const [file] = fake.filesNamed(SYNC_FILE_NAME);
  const parsed = parseSyncFile(fake.contentOf(file));
  if (!parsed.ok) throw new Error("illisible");
  return parsed.file.data;
};

describe("1. journal pas encore lu (ou illisible) sur un téléphone", () => {
  it("son journal vide n'efface pas celui des autres téléphones", async () => {
    const a = new Phone();
    const b = new Phone();
    a.add("t1");
    a.add("t2");
    a.complete("t1");
    tick();
    a.complete("t2");
    await a.sync();
    await b.sync();
    expect(b.data.completions).toHaveLength(2);
    // A relancé : journal pas encore chargé (ou lecture en échec)
    tick();
    a.data = { ...a.data, completions: [] };
    a.add("t3");
    await a.sync();
    await b.sync();
    expect(b.data.completions).toHaveLength(2);
    expect(remoteFile().completions).toHaveLength(2);
  });
});

describe("2. app tuée entre la fusion et l'écriture des données", () => {
  it("au lancement suivant, les entrées reçues ne sont pas prises pour des retraits", async () => {
    const a = new Phone();
    const b = new Phone();
    b.add("tb");
    b.complete("tb");
    await b.sync();
    await a.sync(); // A reçoit l'entrée de B…
    expect(a.data.completions).toHaveLength(1);
    // … mais est tuée avant de l'écrire : au relancement, données d'avant, état de synchronisation gardé
    a.data = { ...EMPTY_SYNC_DATA };
    tick();
    a.add("ta");
    await a.sync();
    await b.sync();
    expect(b.data.completions).toHaveLength(1);
  });

  it("local.apply attend l'écriture des données avant de rendre la main", async () => {
    const written: string[] = [];
    const tasks: Task[] = [];
    const actions = {
      getTasksState: () => ({ tasks, completions: [], isLoaded: true, logReady: true }) as unknown as TasksState,
      getSettings: () => DEFAULT_SETTINGS,
      applySynced: async (data: SyncData) => {
        await new Promise((r) => setTimeout(r, 20));
        written.push("tâches et journal");
        return { tasks: data.tasks, completions: data.completions };
      },
      updateSettings: () => {},
    } as unknown as TaskActions;
    const side = createLocalSide(actions);
    await side.apply({ ...EMPTY_SYNC_DATA, tasks: [makeTask({ id: "r" })] }, { replace: false, settings: null });
    expect(written).toEqual(["tâches et journal"]);
  });
});

describe("7. relecture juste après une fusion", () => {
  it("local.read renvoie les données appliquées, même avant le nouvel affichage", async () => {
    const stale: Task[] = [makeTask({ id: "ancienne" })];
    // État publié seulement après le rendu : encore l'ancien ici
    const published = { tasks: stale, completions: [], isLoaded: true, logReady: true } as unknown as TasksState;
    const actions = {
      getTasksState: () => published,
      getSettings: () => DEFAULT_SETTINGS,
      applySynced: async (data: SyncData) => ({ tasks: [...stale, ...data.tasks], completions: data.completions }),
      updateSettings: () => {},
    } as unknown as TaskActions;
    const side = createLocalSide(actions);
    await side.apply(
      { ...EMPTY_SYNC_DATA, tasks: [makeTask({ id: "recue" })], completions: [{ date: 5, category: "UI" }] },
      { replace: false, settings: null }
    );
    const { data } = await side.read();
    expect(data.tasks.map((t) => t.id).sort()).toEqual(["ancienne", "recue"]);
    expect(data.completions).toEqual([{ date: 5, category: "UI" }]);
  });
});

describe("4. « Reporter 1 h » sur un téléphone en retard", () => {
  it("ne rouvre pas une tâche terminée sur l'autre téléphone ; le report reste propre au téléphone", async () => {
    const a = new Phone();
    const b = new Phone();
    a.add("t", { category: "UI", nagInterval: 60 });
    await a.sync();
    await b.sync();
    tick();
    a.complete("t");
    await a.sync();
    // B n'a pas encore reçu la fin : sa relance arrive, « Reporter 1 h » (passe par stampChanges)
    tick();
    const before = b.data.tasks;
    b.data = { ...b.data, tasks: stampChanges(before, before.map((t) => ({ ...t, snoozedUntil: clock + 3600_000 })), clock) };
    await b.sync();
    await a.sync();
    expect(a.task("t").isDone).toBe(true);
    expect(b.task("t").isDone).toBe(true);
    // Le report n'est pas envoyé
    expect(remoteFile().tasks[0].snoozedUntil).toBeNull();
  });
});

describe("6. historique des révisions sur plusieurs pages", () => {
  it("écriture glissée retrouvée même après plus de 200 révisions", async () => {
    const a = new Phone();
    const b = new Phone();
    a.add("a1");
    await a.sync();
    await b.sync();
    // L'actuel a déjà 250 révisions
    const [file] = fake.filesNamed(SYNC_FILE_NAME);
    const content = fake.contentOf(file);
    for (let i = 0; i < 250; i++) file.revisions.push({ id: `old-${i}`, content, modifiedTime: new Date(T0 + i).toISOString() });
    a.state = { ...a.state, rev: file.revisions.at(-1)!.id };
    b.state = { ...b.state, rev: file.revisions.at(-1)!.id };
    tick();
    a.add("a2");
    b.add("b2");
    let injected = false;
    fake.state.beforeRequest = async (method) => {
      if (!injected && method === "PATCH") {
        injected = true;
        fake.state.beforeRequest = null;
        await b.sync();
      }
    };
    await a.sync();
    expect(injected).toBe(true);
    expect(remoteFile().tasks.map((t) => t.id).sort()).toEqual(["a1", "a2", "b2"]);
  });

  it("notre révision introuvable : vérification impossible notée, synchronisation complète au prochain passage", async () => {
    const a = new Phone();
    a.add("a1");
    await a.sync();
    tick();
    a.add("a2");
    // Historique sans notre nouvelle révision
    fake.state.hideLatestRevision = true;
    await a.sync();
    fake.state.hideLatestRevision = false;
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Vérification"), expect.anything());
    expect(a.state.rev).toBeNull();
    fake.state.requests = [];
    await a.sync();
    expect(fake.state.requests.some((r) => r.url.includes("alt=media"))).toBe(true);
  });
});

describe("9. migration depuis la 1.5", () => {
  const legacy = (tasks: Task[], writtenAt: number) =>
    fake.seed(
      `${DRIVE_FILE_PREFIX}x.json`,
      JSON.stringify(buildBackup({ tasks, settings: DEFAULT_SETTINGS, completions: [], reviewWeeks: [] }, writtenAt)),
      { createdAt: String(writtenAt), tasks: String(tasks.length) }
    );

  it("à égalité de date, la version du téléphone gagne (priorité choisie en 1.5 sans changer updatedAt)", async () => {
    legacy([makeTask({ id: "t", updatedAt: T0 - 5000, priorityWeek: null })], T0 - 1000);
    const a = new Phone();
    a.data = { ...a.data, tasks: [makeTask({ id: "t", updatedAt: T0 - 5000, priorityWeek: "2026-11-09" })] };
    await a.sync();
    expect(a.task("t").priorityWeek).toBe("2026-11-09");
    expect(remoteFile().tasks[0].priorityWeek).toBe("2026-11-09");
  });

  it("dates de la sauvegarde plafonnées à writtenAt - 1 (horloge de l'autre téléphone en avance)", async () => {
    const writtenAt = T0 - 1000;
    legacy([makeTask({ id: "t", title: "Ancien titre", updatedAt: writtenAt + 60_000 })], writtenAt);
    const a = new Phone();
    a.data = { ...a.data, tasks: [makeTask({ id: "t", title: "Titre du téléphone", updatedAt: writtenAt, modifiedAt: writtenAt })] };
    await a.sync();
    expect(a.task("t").title).toBe("Titre du téléphone");
  });
});

it("convergence gardée : deux téléphones finissent avec la même empreinte", async () => {
  const a = new Phone();
  const b = new Phone();
  a.add("x");
  b.add("y");
  await a.sync();
  await b.sync();
  await a.sync();
  expect(hashData(a.data)).toBe(hashData(b.data));
  expect(a.data.completions.map(completionKey)).toEqual(b.data.completions.map(completionKey));
});
