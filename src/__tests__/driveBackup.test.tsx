import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { Alert, AlertButton, AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import { buildBackup, parseBackup, PRE_IMPORT_BACKUP_KEY } from "../backup";
import DriveAutoBackup, { runAutoBackup } from "../components/DriveAutoBackup";
import {
  AUTO_BACKUP_INTERVAL,
  autoBackupDue,
  DEFAULT_DRIVE_STATE,
  DRIVE_FILE_PREFIX,
  DRIVE_STATE_KEY,
  getDriveState,
  KEEP_BACKUPS,
  loadDriveState,
  resetDriveStateForTests,
  RETRY_DELAY,
  updateDriveState,
} from "../drive/driveBackup";
import * as account from "../drive/googleAccount";
import { serializeTasks } from "../migrations";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";

// Connexion Google simulée : aucun module natif, jeton factice
jest.mock("../drive/googleAccount", () => {
  const actual = jest.requireActual("../drive/googleAccount");
  return {
    ...actual,
    isDriveAvailable: () => true,
    signIn: jest.fn(async () => "lea@example.com"),
    accessToken: jest.fn(async () => "jeton-1"),
    discardToken: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
  };
});
const mocked = account as jest.Mocked<typeof account>;

// Google Drive simulé en mémoire (dossier appDataFolder), derrière fetch
interface FakeFile {
  id: string;
  name: string;
  createdTime: string;
  appProperties: Record<string, string>;
  content: string;
  parents: string[];
}
const drive = {
  files: new Map<string, FakeFile>(),
  offline: false,
  rejectToken: null as string | null, // jeton refusé (401)
  requests: [] as { method: string; url: string; token: string | null }[],
  nextId: 1,
};
const respond = (status: number, body: unknown = {}) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }) as Response;

const fetchMock = jest.fn(async (input: string, init: RequestInit = {}) => {
  const method = init.method ?? "GET";
  const token = ((init.headers as Record<string, string>)?.Authorization ?? "").replace("Bearer ", "") || null;
  drive.requests.push({ method, url: input, token });
  if (drive.offline) throw new TypeError("Network request failed");
  if (token === null || token === drive.rejectToken) return respond(401);
  const url = new URL(input);
  if (url.pathname.startsWith("/upload/")) {
    const boundary = /boundary=(.+)$/.exec((init.headers as Record<string, string>)["Content-Type"])![1];
    const parts = String(init.body)
      .split(`--${boundary}`)
      .slice(1, 3)
      .map((p) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""));
    const metadata = JSON.parse(parts[0]);
    const id = `f${drive.nextId++}`;
    const file: FakeFile = {
      id,
      name: metadata.name,
      createdTime: new Date(Date.UTC(2026, 0, 1) + drive.nextId * 1000).toISOString(),
      appProperties: metadata.appProperties,
      content: parts[1],
      parents: metadata.parents,
    };
    drive.files.set(id, file);
    return respond(200, { id, name: file.name, createdTime: file.createdTime, appProperties: file.appProperties });
  }
  const match = /^\/drive\/v3\/files(?:\/([^/]+))?$/.exec(url.pathname)!;
  const id = match[1] && decodeURIComponent(match[1]);
  if (method === "DELETE") return drive.files.delete(id!) ? respond(204) : respond(404);
  if (id) {
    const file = drive.files.get(id);
    return file ? respond(200, file.content) : respond(404);
  }
  expect(url.searchParams.get("spaces")).toBe("appDataFolder");
  const files = [...drive.files.values()]
    .filter((f) => f.name.includes(DRIVE_FILE_PREFIX))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    .map(({ id: fid, name, createdTime, appProperties }) => ({ id: fid, name, createdTime, appProperties }));
  return respond(200, { files });
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

const HOUR = 60 * 60 * 1000;
const scheduled = () =>
  (Notifications as unknown as { __state: { scheduled: { content: { data: { taskId?: string } } }[] } }).__state
    .scheduled;

let actions: TaskActions;
let tasksState: TasksState;
function Grab() {
  actions = useTaskActions();
  tasksState = useTasksSelector((s) => s);
  return null;
}

const renderSettings = async () => {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Grab />
        <SettingsScreen />
        <DriveAutoBackup />
      </TasksProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(tasksState.isLoaded).toBe(true));
  await act(async () => {});
  await act(async () => {});
};

let alerts: { title: string; message?: string; buttons?: AlertButton[] }[];
const pressAlertButton = async (label: string) => {
  const button = alerts.at(-1)!.buttons!.find((b) => b.text === label)!;
  await act(async () => {
    await button.onPress?.();
  });
  await act(async () => {});
};
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
  await act(async () => {});
  await act(async () => {});
};

const localTasks = [makeTask({ id: "local", title: "Tâche du téléphone", category: "UI", updatedAt: Date.now() })];
const remoteTasks = [
  makeTask({ id: "a", title: "Préparer le budget", category: "INU", dueAt: Date.now() + 10 * 24 * HOUR }),
  makeTask({ id: "b", title: "Compte rendu", category: "NDNI" }),
];
// Sauvegarde déjà présente dans le Drive (autre téléphone)
const putRemoteBackup = (createdAt: number, tasks = remoteTasks) => {
  const id = `f${drive.nextId++}`;
  drive.files.set(id, {
    id,
    name: `${DRIVE_FILE_PREFIX}${createdAt}.json`,
    createdTime: new Date(createdAt).toISOString(),
    appProperties: { createdAt: String(createdAt), tasks: String(tasks.length) },
    content: JSON.stringify(
      buildBackup({ tasks, settings: { ...DEFAULT_SETTINGS, onboardingDone: true }, completions: [], reviewWeeks: [] }, createdAt)
    ),
    parents: ["appDataFolder"],
  });
  return id;
};
const connected = () => updateDriveState({ account: "lea@example.com", autoBackup: true });

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveStateForTests();
  drive.files.clear();
  drive.offline = false;
  drive.rejectToken = null;
  drive.requests = [];
  drive.nextId = 1;
  fetchMock.mockClear();
  mocked.signIn.mockReset().mockResolvedValue("lea@example.com");
  mocked.accessToken.mockReset().mockResolvedValue("jeton-1");
  mocked.signOut.mockClear();
  mocked.discardToken.mockClear();
  alerts = [];
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    alerts.push({ title, message, buttons });
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(localTasks));
  await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
});

describe("sans connexion", () => {
  it("rien ne change : bouton de connexion, aucune requête, aucune sauvegarde automatique", async () => {
    await renderSettings();
    expect(screen.getByRole("button", { name: "Sauvegarder sur Google Drive" })).toBeOnTheScreen();
    expect(screen.getByText(/dossier caché réservé à DoFirst/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Sauvegarder maintenant" })).toBeNull();
    // Export et import manuels toujours là
    expect(screen.getByRole("button", { name: "Exporter mes données" })).toBeOnTheScreen();

    expect(await act(() => runAutoBackup(actions))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocked.signIn).not.toHaveBeenCalled();
    expect(mocked.accessToken).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(DRIVE_STATE_KEY)).toBeNull();
  });

  it("« i » de la section : dossier caché, 5 sauvegardes, copie de secours", async () => {
    await renderSettings();
    await fireEvent.press(screen.getByLabelText("En savoir plus : Sauvegarde Google Drive"));
    expect(screen.getByText(/pas même le développeur/)).toBeOnTheScreen();
    expect(screen.getByText(/Les 5 dernières sauvegardes sont gardées/)).toBeOnTheScreen();
  });
});

describe("connexion", () => {
  it("compte affiché, aucune sauvegarde, sauvegarde automatique activée", async () => {
    await renderSettings();
    await press("Sauvegarder sur Google Drive");

    expect(mocked.signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Compte : lea@example.com")).toBeOnTheScreen();
    expect(screen.getByText("Aucune sauvegarde pour l'instant")).toBeOnTheScreen();
    expect(screen.getByRole("switch", { name: "Sauvegarde automatique" }).props.value).toBe(true);
    for (const name of ["Sauvegarder maintenant", "Restaurer depuis Google Drive", "Se déconnecter", "Supprimer ma sauvegarde en ligne"]) {
      expect(screen.getByRole("button", { name })).toBeOnTheScreen();
    }
    // Drive vide : rien à proposer
    expect(alerts).toEqual([]);
    expect(getDriveState()).toMatchObject({ account: "lea@example.com", autoBackup: true, lastBackupAt: null });
  });

  it("connexion annulée : rien ne change", async () => {
    mocked.signIn.mockResolvedValueOnce(null);
    await renderSettings();
    await press("Sauvegarder sur Google Drive");
    expect(screen.getByRole("button", { name: "Sauvegarder sur Google Drive" })).toBeOnTheScreen();
    expect(getDriveState().account).toBeNull();
    expect(alerts).toEqual([]);
  });

  it("échec de la connexion : un message, pas de compte", async () => {
    mocked.signIn.mockRejectedValueOnce(new Error("DEVELOPER_ERROR"));
    await renderSettings();
    await press("Sauvegarder sur Google Drive");
    expect(alerts.at(-1)!.title).toBe("Connexion impossible");
    expect(getDriveState().account).toBeNull();
  });

  it("téléphone neuf : une sauvegarde existe, la restauration est proposée", async () => {
    putRemoteBackup(new Date(2026, 10, 2, 9, 0).getTime());
    await renderSettings();
    await press("Sauvegarder sur Google Drive");

    const offer = alerts.at(-1)!;
    expect(offer.title).toBe("Sauvegarde trouvée");
    expect(offer.message).toContain("2 tâches, sauvegarde du 2 nov.");
    expect(offer.buttons!.map((b) => b.text)).toEqual(["Plus tard", "Restaurer"]);

    await pressAlertButton("Restaurer");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b"]));
    expect(alerts.at(-1)!.title).toBe("Sauvegarde importée");
  });

  it("« Plus tard » : les données du téléphone restent", async () => {
    putRemoteBackup(Date.now() - HOUR);
    await renderSettings();
    await press("Sauvegarder sur Google Drive");
    await pressAlertButton("Plus tard");
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
  });
});

describe("sauvegarde manuelle", () => {
  it("fichier JSON de l'export dans appDataFolder, date affichée", async () => {
    await connected();
    await renderSettings();
    await press("Sauvegarder maintenant");

    expect(alerts.at(-1)!.title).toBe("Sauvegarde terminée");
    const [file] = [...drive.files.values()];
    expect(file.parents).toEqual(["appDataFolder"]);
    expect(file.name.startsWith(DRIVE_FILE_PREFIX)).toBe(true);
    expect(file.appProperties.tasks).toBe("1");
    const parsed = parseBackup(file.content);
    expect(parsed.ok && parsed.backup.tasks.map((t) => t.id)).toEqual(["local"]);
    expect(screen.getByText(/^Dernière sauvegarde : /)).toBeOnTheScreen();
    expect(getDriveState().lastBackupAt).not.toBeNull();
    // Le jeton n'est jamais journalisé
    for (const [, ...args] of (console.warn as jest.Mock).mock.calls) expect(JSON.stringify(args)).not.toContain("jeton");
  });

  it("hors ligne : message, la dernière sauvegarde réussie reste affichée", async () => {
    await connected();
    await renderSettings();
    await press("Sauvegarder maintenant");
    const first = getDriveState().lastBackupAt;

    drive.offline = true;
    await press("Sauvegarder maintenant");
    expect(alerts.at(-1)!.title).toBe("Sauvegarde impossible");
    expect(getDriveState().lastBackupAt).toBe(first);
    expect(screen.getByText(/^Dernière sauvegarde : /)).toBeOnTheScreen();
  });

  it("jeton refusé (401) : renouvelé une fois, la sauvegarde passe", async () => {
    await connected();
    drive.rejectToken = "jeton-1";
    mocked.accessToken.mockResolvedValueOnce("jeton-1").mockResolvedValue("jeton-2");
    await renderSettings();
    await press("Sauvegarder maintenant");
    expect(mocked.discardToken).toHaveBeenCalledWith("jeton-1");
    expect(drive.files.size).toBe(1);
  });

  it("accès retiré : message de reconnexion, compte oublié", async () => {
    await connected();
    mocked.accessToken.mockRejectedValue(new account.NotSignedInError("Session expirée"));
    await renderSettings();
    await press("Sauvegarder maintenant");
    expect(alerts.at(-1)!.title).toBe("Reconnexion nécessaire");
    expect(getDriveState().account).toBeNull();
    expect(screen.getByRole("button", { name: "Sauvegarder sur Google Drive" })).toBeOnTheScreen();
  });
});

describe("rotation", () => {
  it(`garde les ${KEEP_BACKUPS} sauvegardes les plus récentes`, async () => {
    await connected();
    const old = [1, 2, 3, 4, 5, 6].map((d) => putRemoteBackup(Date.UTC(2025, 0, d)));
    await renderSettings();
    await press("Sauvegarder maintenant");

    expect(drive.files.size).toBe(KEEP_BACKUPS);
    // Les deux plus anciennes sont parties, la nouvelle est là
    expect(drive.files.has(old[0])).toBe(false);
    expect(drive.files.has(old[1])).toBe(false);
    expect([...drive.files.values()].some((f) => f.appProperties.tasks === "1")).toBe(true);
  });
});

describe("sauvegarde automatique", () => {
  const T0 = Date.UTC(2026, 10, 8, 12);

  it("règle : connecté, activée, données changées, une fois par jour, 15 min après un échec", () => {
    const on = { ...DEFAULT_DRIVE_STATE, account: "x", lastHash: "h1" };
    expect(autoBackupDue({ ...on, account: null }, "h2", T0)).toBe(false);
    expect(autoBackupDue({ ...on, autoBackup: false }, "h2", T0)).toBe(false);
    expect(autoBackupDue(on, "h1", T0)).toBe(false); // rien n'a changé
    expect(autoBackupDue(on, "h2", T0)).toBe(true);
    expect(autoBackupDue({ ...on, lastBackupAt: T0 - AUTO_BACKUP_INTERVAL + 1 }, "h2", T0)).toBe(false);
    expect(autoBackupDue({ ...on, lastBackupAt: T0 - AUTO_BACKUP_INTERVAL }, "h2", T0)).toBe(true);
    expect(autoBackupDue({ ...on, lastAttemptAt: T0 - RETRY_DELAY + 1 }, "h2", T0)).toBe(false);
    expect(autoBackupDue({ ...on, lastAttemptAt: T0 - RETRY_DELAY }, "h2", T0)).toBe(true);
  });

  it("une fois par jour au plus, et seulement si les données ont changé", async () => {
    await connected();
    await renderSettings();

    expect(await act(() => runAutoBackup(actions, T0))).toBe(true);
    expect(drive.files.size).toBe(1);

    // Même jour, données changées : pas de deuxième envoi
    await act(async () => actions.addTask(makeTask({ id: "new", title: "Nouvelle", category: "INU" })));
    expect(await act(() => runAutoBackup(actions, T0 + 2 * HOUR))).toBe(false);

    // Le lendemain, données changées : envoi
    expect(await act(() => runAutoBackup(actions, T0 + 25 * HOUR))).toBe(true);
    expect(drive.files.size).toBe(2);

    // Encore un jour plus tard, rien n'a changé : pas d'envoi
    expect(await act(() => runAutoBackup(actions, T0 + 50 * HOUR))).toBe(false);
    expect(drive.files.size).toBe(2);
    expect(alerts).toEqual([]);
  });

  it("déclenchée au passage en arrière-plan", async () => {
    const handlers: ((s: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      handlers.push(handler as (s: AppStateStatus) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    await connected();
    await renderSettings();
    await act(async () => handlers.forEach((h) => h("background")));
    await waitFor(() => expect(drive.files.size).toBe(1));
  });

  it("désactivée : rien n'est envoyé", async () => {
    await connected();
    await renderSettings();
    await fireEvent(screen.getByRole("switch", { name: "Sauvegarde automatique" }), "valueChange", false);
    await act(async () => {});
    expect(getDriveState().autoBackup).toBe(false);
    expect(await act(() => runAutoBackup(actions, T0))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hors ligne : silencieux, nouvel essai plus tard ; l'état garde la dernière sauvegarde réussie", async () => {
    await connected();
    await renderSettings();
    expect(await act(() => runAutoBackup(actions, T0))).toBe(true);
    const success = getDriveState().lastBackupAt;

    await act(async () => actions.addTask(makeTask({ id: "new", title: "Nouvelle", category: "INU" })));
    drive.offline = true;
    const t1 = T0 + 25 * HOUR;
    expect(await act(() => runAutoBackup(actions, t1))).toBe(false);
    expect(alerts).toEqual([]);
    expect(getDriveState()).toMatchObject({ lastBackupAt: success, lastAttemptAt: t1 });

    // Toujours dans les 15 min : pas de nouvel essai, même revenu en ligne
    drive.offline = false;
    fetchMock.mockClear();
    expect(await act(() => runAutoBackup(actions, t1 + RETRY_DELAY - 1))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    // Plus tard : l'envoi passe
    expect(await act(() => runAutoBackup(actions, t1 + RETRY_DELAY))).toBe(true);
    expect(getDriveState().lastBackupAt).toBe(t1 + RETRY_DELAY);
  });

  it("accès retiré : plus d'essai automatique, sans message", async () => {
    await connected();
    mocked.accessToken.mockRejectedValue(new account.NotSignedInError("Session expirée"));
    await renderSettings();
    expect(await act(() => runAutoBackup(actions, T0))).toBe(false);
    expect(getDriveState().account).toBeNull();
    expect(alerts).toEqual([]);
  });
});

describe("restauration", () => {
  it("aperçu, confirmation, copie de secours, notifications reprogrammées", async () => {
    await connected();
    putRemoteBackup(Date.UTC(2025, 5, 1));
    putRemoteBackup(new Date(2026, 10, 5, 8, 0).getTime()); // la plus récente
    await renderSettings();
    await press("Restaurer depuis Google Drive");

    const confirm = alerts.at(-1)!;
    expect(confirm.title).toBe("Importer cette sauvegarde ?");
    expect(confirm.message).toContain("2 tâches, sauvegarde du 5 nov.");
    expect(confirm.message).toContain("Une copie de secours est gardée");
    // Rien n'est touché avant la confirmation
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toBeNull();

    await pressAlertButton("Restaurer");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b"]));
    // Copie de secours des données d'avant (« Annuler le dernier import »)
    const copy = JSON.parse((await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY))!);
    expect(copy.data[STORAGE_KEY]).toContain("Tâche du téléphone");
    expect(await screen.findByRole("button", { name: "Annuler le dernier import" })).toBeOnTheScreen();
    // Rappel de la tâche « Planifier » restaurée programmé sur ce téléphone
    await waitFor(() => expect(scheduled().some((n) => n.content.data.taskId === "a")).toBe(true));
    // Données identiques à la sauvegarde : pas de renvoi automatique
    expect(await act(() => runAutoBackup(actions, Date.now() + 2 * AUTO_BACKUP_INTERVAL))).toBe(false);
  });

  it("sauvegarde d'un ancien format : migrations existantes appliquées", async () => {
    await connected();
    const id = putRemoteBackup(Date.now() - HOUR);
    // Format 1.0 : tableau de tâches sans schemaVersion
    const file = JSON.parse(drive.files.get(id)!.content);
    file.tasks = [{ id: "v1", title: "Vieille tâche", category: "INU", done: false }];
    drive.files.get(id)!.content = JSON.stringify(file);
    await renderSettings();
    await press("Restaurer depuis Google Drive");
    await pressAlertButton("Restaurer");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.title)).toEqual(["Vieille tâche"]));
  });

  it("aucune sauvegarde : message", async () => {
    await connected();
    await renderSettings();
    await press("Restaurer depuis Google Drive");
    expect(alerts.at(-1)!.title).toBe("Aucune sauvegarde");
  });

  it("hors ligne : message, rien n'est modifié", async () => {
    await connected();
    putRemoteBackup(Date.now() - HOUR);
    drive.offline = true;
    await renderSettings();
    await press("Restaurer depuis Google Drive");
    expect(alerts.at(-1)!.title).toBe("Restauration impossible");
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
  });

  it("fichier abîmé : refusé, rien n'est modifié", async () => {
    await connected();
    const id = putRemoteBackup(Date.now() - HOUR);
    drive.files.get(id)!.content = "pas du JSON";
    await renderSettings();
    await press("Restaurer depuis Google Drive");
    await pressAlertButton("Restaurer");
    expect(alerts.at(-1)!.title).toBe("Fichier non reconnu");
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
  });
});

describe("suppression de la sauvegarde en ligne", () => {
  it("confirmation, toutes les sauvegardes supprimées, sauvegarde automatique désactivée", async () => {
    await connected();
    putRemoteBackup(Date.now() - 2 * HOUR);
    putRemoteBackup(Date.now() - HOUR);
    await renderSettings();
    await press("Supprimer ma sauvegarde en ligne");
    expect(alerts.at(-1)!.title).toBe("Supprimer ta sauvegarde en ligne ?");
    expect(drive.files.size).toBe(2); // rien avant la confirmation

    await pressAlertButton("Supprimer");
    expect(drive.files.size).toBe(0);
    expect(alerts.at(-1)!.title).toBe("Sauvegarde en ligne supprimée");
    expect(getDriveState()).toMatchObject({ account: "lea@example.com", autoBackup: false, lastBackupAt: null });
    // Les données du téléphone ne changent pas
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
  });
});

describe("déconnexion", () => {
  it("confirmation, compte oublié, sauvegarde en ligne gardée, plus d'envoi automatique", async () => {
    await connected();
    putRemoteBackup(Date.now() - HOUR);
    await renderSettings();
    await press("Se déconnecter");
    expect(alerts.at(-1)!.title).toBe("Se déconnecter de Google Drive ?");
    await pressAlertButton("Se déconnecter");

    expect(mocked.signOut).toHaveBeenCalledTimes(1);
    expect(getDriveState()).toEqual(DEFAULT_DRIVE_STATE);
    expect(drive.files.size).toBe(1);
    expect(screen.getByRole("button", { name: "Sauvegarder sur Google Drive" })).toBeOnTheScreen();
    fetchMock.mockClear();
    expect(await act(() => runAutoBackup(actions, Date.now()))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("état enregistré", () => {
  it("relu au lancement ; une restauration ne l'écrase pas (clé à part des réglages)", async () => {
    await AsyncStorage.setItem(
      DRIVE_STATE_KEY,
      JSON.stringify({ account: "lea@example.com", autoBackup: false, lastBackupAt: 1, lastHash: "h", lastAttemptAt: null })
    );
    expect(await loadDriveState()).toMatchObject({ account: "lea@example.com", autoBackup: false });
    await AsyncStorage.setItem(DRIVE_STATE_KEY, "{abîmé");
    resetDriveStateForTests();
    expect(await loadDriveState()).toEqual(DEFAULT_DRIVE_STATE);
  });
});
