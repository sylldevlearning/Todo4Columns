// Google Drive simulé en mémoire pour les tests (dossier appDataFolder, révisions comprises),
// derrière fetch. Les tests y branchent plusieurs « téléphones » qui partagent le même Drive.

export interface FakeRevision {
  id: string;
  content: string;
  modifiedTime: string;
}

export interface FakeFile {
  id: string;
  name: string;
  createdTime: string;
  appProperties: Record<string, string>;
  parents: string[];
  revisions: FakeRevision[];
}

export interface FakeDriveState {
  files: Map<string, FakeFile>;
  offline: boolean;
  revisionsBroken: boolean; // historique des révisions refusé (403)
  hideLatestRevision: boolean; // historique sans la dernière révision (pas encore visible)
  rejectToken: string | null; // jeton refusé (401)
  requests: { method: string; url: string; token: string | null }[];
  // Appelée avant chaque requête (pour glisser l'écriture d'un autre téléphone au milieu)
  beforeRequest: ((method: string, url: URL) => Promise<void> | void) | null;
}

const respond = (status: number, body: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }) as Response;

export function createFakeDrive() {
  let counter = 0;
  const tick = () => new Date(Date.UTC(2026, 10, 1) + ++counter * 1000).toISOString();
  const state: FakeDriveState = {
    files: new Map(),
    offline: false,
    revisionsBroken: false,
    hideLatestRevision: false,
    rejectToken: null,
    requests: [],
    beforeRequest: null,
  };
  let nextId = 1;
  let nextRev = 1;

  const meta = (f: FakeFile) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    appProperties: f.appProperties,
    headRevisionId: f.revisions[f.revisions.length - 1]?.id,
  });
  const head = (f: FakeFile) => f.revisions[f.revisions.length - 1].content;
  const addRevision = (f: FakeFile, content: string) =>
    f.revisions.push({ id: `rev-${nextRev++}`, content, modifiedTime: tick() });

  const parseMultipart = (init: RequestInit) => {
    const boundary = /boundary=(.+)$/.exec((init.headers as Record<string, string>)["Content-Type"])![1];
    const parts = String(init.body)
      .split(`--${boundary}`)
      .slice(1, 3)
      .map((p) => p.slice(p.indexOf("\r\n\r\n") + 4, p.lastIndexOf("\r\n")));
    return { metadata: JSON.parse(parts[0]) as Record<string, unknown>, content: parts[1] };
  };

  const fetchImpl = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? "GET";
    const token = ((init.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "") || null;
    const url = new URL(input);
    if (state.beforeRequest) {
      const hook = state.beforeRequest;
      await hook(method, url);
    }
    state.requests.push({ method, url: input, token });
    if (state.offline) throw new TypeError("Network request failed");
    if (token === null || token === state.rejectToken) return respond(401);

    const path = url.pathname;
    // Envoi d'un nouveau fichier, ou d'une nouvelle révision
    if (path.startsWith("/upload/drive/v3/files")) {
      const { metadata, content } = parseMultipart(init);
      if (method === "POST") {
        const file: FakeFile = {
          id: `file-${nextId++}`,
          name: String(metadata.name),
          createdTime: tick(),
          appProperties: (metadata.appProperties as Record<string, string>) ?? {},
          parents: (metadata.parents as string[]) ?? [],
          revisions: [],
        };
        addRevision(file, content);
        state.files.set(file.id, file);
        return respond(200, meta(file));
      }
      const id = decodeURIComponent(path.split("/").pop()!);
      const file = state.files.get(id);
      if (!file) return respond(404);
      addRevision(file, content);
      file.appProperties = { ...file.appProperties, ...((metadata.appProperties as Record<string, string>) ?? {}) };
      return respond(200, meta(file));
    }

    const parts = path.replace(/^\/drive\/v3\/files\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    if (parts.length === 0) {
      // Liste : « name contains '…' » dans appDataFolder
      const q = url.searchParams.get("q") ?? "";
      const wanted = /name contains '(.*)'/.exec(q)?.[1]?.replace(/\\'/g, "'") ?? "";
      const files = [...state.files.values()]
        .filter((f) => f.parents.includes("appDataFolder") && f.name.includes(wanted))
        .sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime))
        .map(meta);
      return respond(200, { files });
    }
    const file = state.files.get(parts[0]);
    if (!file) return respond(404);
    if (parts.length === 1) {
      if (method === "DELETE") {
        state.files.delete(file.id);
        return respond(204);
      }
      if (url.searchParams.get("alt") === "media") return respond(200, head(file));
      return respond(200, meta(file));
    }
    if (parts[1] === "revisions") {
      if (state.revisionsBroken) return respond(403);
      if (parts.length === 2) {
        // Pages de pageSize révisions (200 au plus), de la plus ancienne à la plus récente
        const all = state.hideLatestRevision ? file.revisions.slice(0, -1) : file.revisions;
        const size = Math.min(Number(url.searchParams.get("pageSize") ?? 200), 200);
        const start = Number(url.searchParams.get("pageToken") ?? 0);
        const page = all.slice(start, start + size).map((r) => ({ id: r.id, modifiedTime: r.modifiedTime }));
        const next = start + size < all.length ? String(start + size) : undefined;
        return respond(200, { revisions: page, ...(next ? { nextPageToken: next } : {}) });
      }
      const revision = file.revisions.find((r) => r.id === parts[2]);
      return revision ? respond(200, revision.content) : respond(404);
    }
    return respond(400);
  };

  return {
    state,
    fetch: fetchImpl,
    // Fichiers dont le nom commence par prefix (contenu actuel)
    filesNamed: (prefix: string) => [...state.files.values()].filter((f) => f.name.startsWith(prefix)),
    contentOf: (f: FakeFile) => head(f),
    // Ajoute un fichier tel quel (sauvegarde de la 1.5…)
    seed(name: string, content: string, appProperties: Record<string, string> = {}) {
      const file: FakeFile = {
        id: `file-${nextId++}`,
        name,
        createdTime: tick(),
        appProperties,
        parents: ["appDataFolder"],
        revisions: [],
      };
      addRevision(file, content);
      state.files.set(file.id, file);
      return file;
    },
  };
}

export type FakeDrive = ReturnType<typeof createFakeDrive>;
