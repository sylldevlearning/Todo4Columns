import { accessToken, discardToken } from "./googleAccount";

// API REST de Google Drive v3, limitée au dossier caché de l'app (appDataFolder, scope
// drive.appdata) : DoFirst n'y lit et n'y écrit que ses propres fichiers.

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

// Réponse d'erreur de Drive (le corps n'est jamais journalisé : il peut citer le compte)
export class DriveError extends Error {
  constructor(readonly status: number) {
    super(`Google Drive : HTTP ${status}`);
  }
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime: string; // ISO 8601
  appProperties?: Record<string, string>;
  headRevisionId?: string; // révision du contenu actuel (change à chaque envoi de contenu)
}

const FILE_FIELDS = "id,name,createdTime,appProperties,headRevisionId";

// Requête authentifiée ; un jeton refusé (401) est renouvelé une fois
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken();
    const response = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 && attempt === 0) {
      await discardToken(token);
      continue;
    }
    if (!response.ok) throw new DriveError(response.status);
    return response;
  }
}

const CRLF = "\r\n";

// Corps « multipart » : métadonnées puis contenu JSON
function multipart(metadata: object, content: string): { boundary: string; body: string } {
  const boundary = `dofirst-${Date.now().toString(36)}`;
  const part = (text: string) =>
    `--${boundary}${CRLF}Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}${text}${CRLF}`;
  return { boundary, body: part(JSON.stringify(metadata)) + part(content) + `--${boundary}--` };
}

// Fichiers de l'app dont le nom commence par prefix, du plus récent au plus ancien
export async function listFiles(prefix: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name contains '${prefix.replace(/'/g, "\\'")}'`,
    orderBy: "createdTime desc",
    pageSize: "100",
    fields: `files(${FILE_FIELDS})`,
  });
  const data = (await (await request(`${API}?${params}`)).json()) as { files?: DriveFile[] };
  return (data.files ?? [])
    .filter((f) => f.name.startsWith(prefix))
    .sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime));
}

// Envoi d'un nouveau fichier JSON dans le dossier caché de l'app
export async function uploadJson(
  name: string,
  content: string,
  appProperties: Record<string, string>
): Promise<DriveFile> {
  const { boundary, body } = multipart(
    { name, mimeType: "application/json", parents: ["appDataFolder"], appProperties },
    content
  );
  const response = await request(`${UPLOAD}?uploadType=multipart&fields=${FILE_FIELDS}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await response.json()) as DriveFile;
}

// Remplace le contenu d'un fichier (nouvelle révision) et renvoie ses métadonnées
export async function updateContent(
  id: string,
  content: string,
  appProperties: Record<string, string> = {}
): Promise<DriveFile> {
  const { boundary, body } = multipart({ appProperties }, content);
  const response = await request(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=multipart&fields=${FILE_FIELDS}`, {
    method: "PATCH",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await response.json()) as DriveFile;
}

// Métadonnées d'un fichier (révision actuelle comprise) ; null s'il n'existe plus
export async function getFile(id: string): Promise<DriveFile | null> {
  try {
    return (await (await request(`${API}/${encodeURIComponent(id)}?fields=${FILE_FIELDS}`)).json()) as DriveFile;
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return null;
    throw e;
  }
}

export async function downloadText(id: string): Promise<string> {
  return (await request(`${API}/${encodeURIComponent(id)}?alt=media`)).text();
}

export async function deleteFile(id: string): Promise<void> {
  try {
    await request(`${API}/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return; // déjà supprimé
    throw e;
  }
}

export interface DriveRevision {
  id: string;
  modifiedTime: string; // ISO 8601
}

// Toutes les révisions du contenu d'un fichier (toutes les pages), de la plus ancienne à la plus
// récente
export async function listRevisions(id: string): Promise<DriveRevision[]> {
  const all: DriveRevision[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "200", fields: "nextPageToken,revisions(id,modifiedTime)" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = (await (await request(`${API}/${encodeURIComponent(id)}/revisions?${params}`)).json()) as {
      revisions?: DriveRevision[];
      nextPageToken?: string;
    };
    all.push(...(data.revisions ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

export async function downloadRevision(id: string, revision: string): Promise<string> {
  return (
    await request(`${API}/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revision)}?alt=media`)
  ).text();
}
