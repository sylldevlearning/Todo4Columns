import { accessToken, discardToken } from "./googleAccount";

// API REST de Google Drive v3, limitée au dossier caché de l'app (appDataFolder, scope
// drive.appdata) : DoFirst n'y lit et n'y écrit que ses propres sauvegardes.

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
}

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

// Fichiers de l'app dont le nom commence par prefix, du plus récent au plus ancien
export async function listFiles(prefix: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name contains '${prefix.replace(/'/g, "\\'")}'`,
    orderBy: "createdTime desc",
    pageSize: "100",
    fields: "files(id,name,createdTime,appProperties)",
  });
  const data = (await (await request(`${API}?${params}`)).json()) as { files?: DriveFile[] };
  return (data.files ?? [])
    .filter((f) => f.name.startsWith(prefix))
    .sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime));
}

// Envoi d'un fichier JSON dans le dossier caché de l'app (envoi « multipart » : métadonnées + contenu)
export async function uploadJson(
  name: string,
  content: string,
  appProperties: Record<string, string>
): Promise<DriveFile> {
  const boundary = `dofirst-${Date.now().toString(36)}`;
  const metadata = { name, mimeType: "application/json", parents: ["appDataFolder"], appProperties };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${boundary}--`;
  const response = await request(`${UPLOAD}?uploadType=multipart&fields=id,name,createdTime,appProperties`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await response.json()) as DriveFile;
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
