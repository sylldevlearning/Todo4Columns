import { buildBackup } from "../backup";
import { Completion } from "../completionLog";
import { DRIVE_FILE_PREFIX } from "../drive/driveBackup";
import {
  DEFAULT_SYNC_STATE,
  KEEP_COPIES,
  LocalSide,
  peekRemote,
  StateStore,
  syncOnce,
  SyncFileError,
  SyncMode,
  SyncState,
} from "../sync/engine";
import { completionKey, EMPTY_SYNC_DATA, hashData, mergeData, SyncData, TOMBSTONE_TTL } from "../sync/merge";
import { driveRemote } from "../sync/remote";
import { COPY_PREFIX, parseSyncFile, SYNC_FILE_NAME, SYNC_VERSION } from "../sync/syncFile";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { createFakeDrive, FakeDrive } from "../testing/fakeDrive";
import { makeTask } from "../testing/makeTask";
import { Task } from "../types";

// Synchronisation entre plusieurs téléphones, sur un Google Drive simulé (révisions comprises).
// Chaque « téléphone » a ses données, son état de synchronisation et son horloge.

jest.mock("../drive/googleAccount", () => ({
  ...jest.requireActual("../drive/googleAccount"),
  accessToken: jest.fn(async () => "jeton"),
  discardToken: jest.fn(async () => {}),
}));

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 10, 9, 9, 0).getTime();

let fake: FakeDrive;
let clock: number;
const tick = (ms = 1000) => (clock += ms);

beforeEach(() => {
  fake = createFakeDrive();
  globalThis.fetch = fake.fetch as unknown as typeof fetch;
  clock = T0;
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

class Phone {
  data: SyncData = { ...EMPTY_SYNC_DATA };
  settings: Settings = { ...DEFAULT_SETTINGS };
  state: SyncState = { ...DEFAULT_SYNC_STATE };
  ownLegacy: number | null = null;
  constructor(readonly name: string) {}

  store: StateStore = {
    load: async () => this.state,
    save: async (s) => {
      this.state = s;
    },
  };

  // Comme applySynced : fusion avec les données actuelles (ou remplacement)
  local: LocalSide = {
    read: async () => ({ data: this.data, settings: this.settings }),
    apply: async (data, { replace, settings }) => {
      this.data = replace ? data : mergeData(this.data, data, clock);
      if (settings) this.settings = settings;
    },
  };

  sync(mode?: SyncMode, adoptSettings = false) {
    return syncOnce(
      { remote: driveRemote, local: this.local, store: this.store, now: () => clock, isOwnLegacy: (w) => w === this.ownLegacy },
      { mode, adoptSettings }
    );
  }

  // Modifications locales (ce que fait stampChanges dans l'app)
  add(id: string, title = id, extra: Partial<Task> = {}) {
    this.data = { ...this.data, tasks: [...this.data.tasks, makeTask({ id, title, createdAt: clock, updatedAt: clock, modifiedAt: clock, ...extra })] };
  }
  edit(id: string, patch: Partial<Task>) {
    this.data = {
      ...this.data,
      tasks: this.data.tasks.map((t) => (t.id === id ? { ...t, ...patch, modifiedAt: clock } : t)),
    };
  }
  remove(id: string) {
    this.data = {
      ...this.data,
      tasks: this.data.tasks.filter((t) => t.id !== id),
      deleted: [...this.data.deleted.filter((d) => d.id !== id), { id, deletedAt: clock }],
    };
  }
  complete(id: string) {
    const task = this.task(id)!;
    this.edit(id, { isDone: true, completedAt: clock });
    this.data = { ...this.data, completions: [...this.data.completions, { date: clock, category: task.category }] };
  }
  // Comme useCompletionLog : le retrait de l'entrée est noté au moment où il se produit
  reopen(id: string) {
    const task = this.task(id)!;
    const done = task.completedAt!;
    this.edit(id, { isDone: false, completedAt: null });
    this.data = {
      ...this.data,
      completions: this.data.completions.filter((c) => c.date !== done),
      removedCompletions: [...this.data.removedCompletions, { key: `${done}|${task.category}`, removedAt: clock }],
    };
  }
  task = (id: string) => this.data.tasks.find((t) => t.id === id);
  ids = () => this.data.tasks.map((t) => t.id).sort();
  titles = () => Object.fromEntries(this.data.tasks.map((t) => [t.id, t.title]));
}

const currentFile = () => {
  const files = fake.filesNamed(SYNC_FILE_NAME);
  expect(files).toHaveLength(1);
  const parsed = parseSyncFile(fake.contentOf(files[0]));
  if (!parsed.ok) throw new Error("fichier illisible");
  return parsed.file;
};
const remoteIds = () => currentFile().data.tasks.map((t) => t.id).sort();
const same = (a: Phone, b: Phone) => expect(hashData(a.data)).toBe(hashData(b.data));

describe("deux téléphones", () => {
  it("ajouts des deux côtés : chacun reçoit les tâches de l'autre", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("a1");
    b.add("b1");
    await a.sync();
    tick();
    await b.sync();
    tick();
    await a.sync();
    expect(a.ids()).toEqual(["a1", "b1"]);
    expect(b.ids()).toEqual(["a1", "b1"]);
    expect(remoteIds()).toEqual(["a1", "b1"]);
    same(a, b);
  });

  it("rien n'a changé : aucun téléchargement ni envoi, une seule requête", async () => {
    const a = new Phone("A");
    a.add("a1");
    await a.sync();
    tick();
    fake.state.requests = [];
    const result = await a.sync();
    expect(result).toEqual({ applied: false, uploaded: false, attempts: 1 });
    expect(fake.state.requests.map((r) => r.method)).toEqual(["GET"]); // liste : révision de l'actuel
  });

  it("modification concurrente : la plus récente gagne partout", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("t", "Original");
    await a.sync();
    await b.sync();
    tick();
    a.edit("t", { title: "Version A" });
    tick();
    b.edit("t", { title: "Version B (plus récente)" });
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.titles()).toEqual({ t: "Version B (plus récente)" });
    expect(b.titles()).toEqual({ t: "Version B (plus récente)" });
    same(a, b);
  });

  it("même horloge à la milliseconde : les deux téléphones choisissent la même version", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("t", "Original");
    await a.sync();
    await b.sync();
    tick();
    a.edit("t", { title: "Alpha" });
    b.edit("t", { title: "Bravo" });
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.titles()).toEqual(b.titles());
    same(a, b);
  });

  it("suppression d'un côté, modification plus ancienne de l'autre : la suppression gagne", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("t");
    await a.sync();
    await b.sync();
    tick();
    b.edit("t", { title: "Modifiée" });
    tick();
    a.remove("t");
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.ids()).toEqual([]);
    expect(b.ids()).toEqual([]);
    expect(currentFile().data.deleted.map((d) => d.id)).toEqual(["t"]);
  });

  it("suppression d'un côté, modification plus récente de l'autre : la tâche revient", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("t");
    await a.sync();
    await b.sync();
    tick();
    a.remove("t");
    tick();
    b.edit("t", { title: "Modifiée après" });
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.titles()).toEqual({ t: "Modifiée après" });
    expect(b.titles()).toEqual({ t: "Modifiée après" });
    // La pierre tombale est oubliée : la tâche ne disparaîtra pas plus tard
    expect(currentFile().data.deleted).toEqual([]);
    expect(a.data.deleted).toEqual([]);
  });

  it("trois téléphones : tout le monde converge", async () => {
    const phones = [new Phone("A"), new Phone("B"), new Phone("C")];
    phones.forEach((p, i) => p.add(`p${i}`));
    for (let round = 0; round < 2; round++) for (const p of phones) await p.sync();
    for (const p of phones) expect(p.ids()).toEqual(["p0", "p1", "p2"]);
    same(phones[0], phones[2]);
  });
});

describe("écritures croisées", () => {
  it("un autre téléphone écrit pendant notre échange : rien n'est écrit, on retélécharge et refusionne", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("a1");
    await a.sync();
    await b.sync();
    tick();
    a.add("a2");
    b.add("b2");
    // B écrit juste avant la vérification de A
    let injected = false;
    fake.state.beforeRequest = async (method, url) => {
      // Vérification de la révision juste avant l'envoi
      if (!injected && method === "GET" && url.pathname.endsWith(`/${a.state.fileId}`) && !url.search.includes("alt=media")) {
        injected = true;
        fake.state.beforeRequest = null;
        await b.sync();
      }
    };
    const result = await a.sync();
    expect(injected).toBe(true);
    expect(result.attempts).toBeGreaterThanOrEqual(2);
    expect(remoteIds()).toEqual(["a1", "a2", "b2"]);
    expect(a.ids()).toEqual(["a1", "a2", "b2"]);
  });

  it("écriture glissée entre la vérification et l'envoi : retrouvée dans les révisions, refusionnée", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("a1");
    await a.sync();
    await b.sync();
    tick();
    a.add("a2");
    b.add("b2");
    // B écrit pendant que A envoie (après sa vérification) : l'envoi de A écrase celui de B
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
    // Le contenu de B est dans le fichier final, et A l'a reçu
    expect(remoteIds()).toEqual(["a1", "a2", "b2"]);
    expect(a.ids()).toEqual(["a1", "a2", "b2"]);
    tick();
    await b.sync();
    same(a, b);
  });

  it("historique des révisions indisponible : l'autre téléphone renvoie ses changements à sa prochaine synchronisation", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("a1");
    await a.sync();
    await b.sync();
    tick();
    a.add("a2");
    b.add("b2");
    fake.state.revisionsBroken = true;
    let injected = false;
    fake.state.beforeRequest = async (method) => {
      if (!injected && method === "PATCH") {
        injected = true;
        fake.state.beforeRequest = null;
        await b.sync();
      }
    };
    await a.sync();
    expect(remoteIds()).toEqual(["a1", "a2"]); // b2 écrasé pour l'instant…
    tick();
    await b.sync(); // … mais B l'a toujours et le renvoie
    expect(remoteIds()).toEqual(["a1", "a2", "b2"]);
    await a.sync();
    same(a, b);
  });

  it("deux téléphones créent l'actuel en même temps : les deux fichiers sont fusionnés, un seul reste", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.state = { ...a.state, migrated: true };
    b.state = { ...b.state, migrated: true };
    a.add("a1");
    b.add("b1");
    let injected = false;
    fake.state.beforeRequest = async (method) => {
      if (!injected && method === "POST") {
        injected = true;
        fake.state.beforeRequest = null;
        await b.sync();
      }
    };
    await a.sync();
    expect(fake.filesNamed(SYNC_FILE_NAME)).toHaveLength(2);
    tick();
    await a.sync();
    expect(fake.filesNamed(SYNC_FILE_NAME)).toHaveLength(1);
    expect(remoteIds()).toEqual(["a1", "b1"]);
    await b.sync();
    same(a, b);
  });
});

describe("hors ligne", () => {
  it("échec sans rien perdre, puis tout part au retour du réseau", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("a1");
    await a.sync();
    fake.state.offline = true;
    tick();
    a.add("hors-ligne");
    await expect(a.sync()).rejects.toThrow(TypeError);
    expect(a.ids()).toEqual(["a1", "hors-ligne"]);
    fake.state.offline = false;
    tick();
    await a.sync();
    await b.sync();
    expect(b.ids()).toEqual(["a1", "hors-ligne"]);
  });
});

describe("pierres tombales", () => {
  it("gardées 90 jours dans le fichier, puis oubliées", async () => {
    const a = new Phone("A");
    a.add("t");
    await a.sync();
    a.remove("t");
    await a.sync();
    expect(currentFile().data.deleted).toEqual([{ id: "t", deletedAt: clock }]);
    clock += TOMBSTONE_TTL - DAY;
    a.add("x");
    await a.sync();
    expect(currentFile().data.deleted.map((d) => d.id)).toEqual(["t"]);
    clock += 2 * DAY;
    a.add("y");
    await a.sync();
    expect(currentFile().data.deleted).toEqual([]);
    expect(a.data.deleted).toEqual([]);
  });

  it("limite connue : un téléphone resté hors ligne plus de 90 jours fait revenir la tâche", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("t");
    await a.sync();
    await b.sync();
    a.remove("t");
    await a.sync();
    clock += TOMBSTONE_TTL + DAY;
    a.add("x");
    await a.sync(); // pierre tombale expirée
    await b.sync(); // B n'a pas synchronisé depuis 3 mois : il a toujours « t »
    expect(b.ids()).toEqual(["t", "x"]);
    expect(remoteIds()).toEqual(["t", "x"]);
  });
});

describe("journal des fins et revues", () => {
  it("union sans doublons ; une tâche rouverte retire son entrée partout", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.add("t1", "t1", { category: "INU" });
    a.add("t2");
    await a.sync();
    await b.sync();
    tick();
    a.complete("t1");
    tick();
    b.complete("t2");
    await a.sync();
    await b.sync();
    await a.sync();
    const keys = (p: Phone) => p.data.completions.map(completionKey);
    expect(keys(a)).toHaveLength(2);
    expect(keys(a)).toEqual(keys(b));
    expect(currentFile().data.completions).toHaveLength(2);
    // Rouverte sur B : l'entrée disparaît aussi de A, et ne revient pas
    tick();
    b.reopen("t1");
    await b.sync();
    await a.sync();
    await b.sync();
    expect(keys(a)).toEqual(keys(b));
    expect(a.data.completions).toHaveLength(1);
    expect(a.task("t1")!.isDone).toBe(false);
  });

  it("deux tâches terminées dans la même milliseconde : deux entrées", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    const both: Completion[] = [
      { date: clock, category: "UI" },
      { date: clock, category: "UI" },
    ];
    a.data = { ...a.data, completions: both };
    await a.sync();
    await b.sync();
    expect(b.data.completions).toEqual(both);
  });

  it("revues de la semaine : union", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.data = { ...a.data, reviewWeeks: ["2026-11-02"] };
    b.data = { ...b.data, reviewWeeks: ["2026-11-09"] };
    await a.sync();
    await b.sync();
    await a.sync();
    expect(a.data.reviewWeeks).toEqual(["2026-11-09", "2026-11-02"]);
    expect(b.data.reviewWeeks).toEqual(["2026-11-09", "2026-11-02"]);
  });

  it("les réglages restent propres à chaque téléphone", async () => {
    const a = new Phone("A");
    const b = new Phone("B");
    a.settings = { ...a.settings, autoArchive: false };
    a.add("a1");
    await a.sync();
    await b.sync();
    expect(b.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("migration depuis la 1.5", () => {
  const legacy = (tasks: Task[], createdAt: number) => {
    const file = buildBackup(
      { tasks, settings: { ...DEFAULT_SETTINGS, autoArchive: false }, completions: [], reviewWeeks: ["2026-11-02"] },
      createdAt
    );
    fake.seed(`${DRIVE_FILE_PREFIX}x.json`, JSON.stringify(file), { createdAt: String(createdAt), tasks: String(tasks.length) });
  };

  it("sauvegarde d'un autre téléphone : point de départ de la synchronisation, rien n'est perdu", async () => {
    legacy([makeTask({ id: "vieux", title: "Sauvegardée en 1.5", updatedAt: T0 - DAY })], T0 - DAY);
    const a = new Phone("A");
    a.add("neuf");
    await a.sync();
    expect(a.ids()).toEqual(["neuf", "vieux"]);
    expect(remoteIds()).toEqual(["neuf", "vieux"]);
    expect(a.data.reviewWeeks).toEqual(["2026-11-02"]);
    expect(a.settings).toEqual(DEFAULT_SETTINGS); // réglages du téléphone gardés
    // La sauvegarde de la 1.5 n'est reprise qu'une fois, et reste en place
    a.remove("vieux");
    await a.sync();
    expect(remoteIds()).toEqual(["neuf"]);
    expect(fake.filesNamed(DRIVE_FILE_PREFIX)).toHaveLength(1);
  });

  it("sauvegarde faite par ce téléphone : ses données sont plus récentes, une tâche supprimée depuis ne revient pas", async () => {
    legacy([makeTask({ id: "garde" }), makeTask({ id: "supprimee-depuis" })], T0 - DAY);
    const a = new Phone("A");
    a.ownLegacy = T0 - DAY;
    a.add("garde");
    await a.sync();
    expect(a.ids()).toEqual(["garde"]);
    expect(remoteIds()).toEqual(["garde"]);
  });

  it("téléphone vide qui se connecte : tout est récupéré, réglages compris", async () => {
    legacy([makeTask({ id: "vieux" })], T0 - DAY);
    const b = new Phone("B");
    const peek = await peekRemote(driveRemote);
    expect(peek?.data.tasks.map((t) => t.id)).toEqual(["vieux"]);
    await b.sync("replaceLocal", true);
    expect(b.ids()).toEqual(["vieux"]);
    expect(b.settings.autoArchive).toBe(false);
  });

  it("un autre téléphone a déjà créé l'actuel : la sauvegarde de la 1.5 n'est pas relue", async () => {
    legacy([makeTask({ id: "vieux" })], T0 - DAY);
    const a = new Phone("A");
    await a.sync();
    a.remove("vieux");
    await a.sync();
    const b = new Phone("B");
    b.add("b1");
    await b.sync();
    expect(b.ids()).toEqual(["b1"]);
  });
});

describe("choix à la connexion", () => {
  const setup = async () => {
    const a = new Phone("A");
    a.add("en-ligne");
    a.add("commune", "Version en ligne");
    await a.sync();
    tick();
    const b = new Phone("B");
    b.add("locale");
    b.add("commune", "Version du téléphone");
    return { a, b };
  };

  it("« Fusionner » : tout est gardé", async () => {
    const { b } = await setup();
    await b.sync("merge");
    expect(b.ids()).toEqual(["commune", "en-ligne", "locale"]);
    expect(remoteIds()).toEqual(["commune", "en-ligne", "locale"]);
  });

  it("« Remplacer par Google Drive » : le téléphone prend les données en ligne, ses réglages restent", async () => {
    const { b } = await setup();
    b.settings = { ...b.settings, autoArchive: false };
    await b.sync("replaceLocal");
    expect(b.titles()).toEqual({ "en-ligne": "en-ligne", commune: "Version en ligne" });
    expect(remoteIds()).toEqual(["commune", "en-ligne"]);
    expect(b.settings.autoArchive).toBe(false);
  });

  it("« Garder ce téléphone » : ses données remplacent l'actuel, et les autres téléphones suivent", async () => {
    const { a, b } = await setup();
    tick();
    await b.sync("keepLocal");
    expect(remoteIds()).toEqual(["commune", "locale"]);
    tick();
    await a.sync();
    expect(a.titles()).toEqual({ locale: "locale", commune: "Version du téléphone" });
  });
});

describe("copies quotidiennes", () => {
  it(`une par jour, les ${KEEP_COPIES} derniers jours gardés`, async () => {
    const a = new Phone("A");
    for (let d = 0; d < 7; d++) {
      a.add(`jour-${d}`);
      await a.sync();
      tick(60 * 1000);
      a.add(`jour-${d}-bis`);
      await a.sync(); // même jour : pas de nouvelle copie
      clock += DAY;
    }
    const copies = await driveRemote.listCopies();
    expect(copies).toHaveLength(KEEP_COPIES);
    expect(copies.map((c) => c.day)).toEqual(["2026-11-15", "2026-11-14", "2026-11-13", "2026-11-12", "2026-11-11"]);
    // La copie du jour garde l'état de la première synchronisation de la journée
    const newest = fake.filesNamed(`${COPY_PREFIX}2026-11-15`)[0];
    const parsed = parseSyncFile(fake.contentOf(newest));
    expect(parsed.ok && parsed.file.data.tasks.some((t) => t.id === "jour-6")).toBe(true);
    expect(parsed.ok && parsed.file.data.tasks.some((t) => t.id === "jour-6-bis")).toBe(false);
  });

  it("une copie impossible n'empêche pas la synchronisation", async () => {
    const a = new Phone("A");
    a.add("a1");
    fake.state.beforeRequest = (method, url) => {
      if (method === "POST" && fake.filesNamed(SYNC_FILE_NAME).length === 1) fake.state.offline = true;
      void url;
    };
    await a.sync();
    fake.state.offline = false;
    fake.state.beforeRequest = null;
    expect(remoteIds()).toEqual(["a1"]);
    expect(a.state.copyDay).toBeNull(); // nouvel essai à la prochaine synchronisation
  });
});

describe("fichiers refusés", () => {
  it("fichier d'une version plus récente de l'app : jamais écrasé", async () => {
    fake.seed(SYNC_FILE_NAME, JSON.stringify({ app: "dofirst", kind: "sync", syncVersion: SYNC_VERSION + 1 }));
    const a = new Phone("A");
    a.add("a1");
    await expect(a.sync()).rejects.toEqual(new SyncFileError("newer"));
    expect(fake.state.requests.some((r) => r.method === "PATCH")).toBe(false);
  });

  it("fichier abîmé : refusé, rien n'est modifié sur le téléphone", async () => {
    fake.seed(SYNC_FILE_NAME, "{pas du json");
    const a = new Phone("A");
    a.add("a1");
    await expect(a.sync()).rejects.toBeInstanceOf(SyncFileError);
    expect(a.ids()).toEqual(["a1"]);
  });
});
