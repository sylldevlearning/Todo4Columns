import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";
import { Alert, AlertButton, AlertOptions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import { buildBackup, PRE_IMPORT_BACKUP_KEY } from "../backup";
import CloudButton from "../components/CloudButton";
import DriveSync from "../components/DriveSync";
import {
  DEFAULT_DRIVE_STATE,
  DRIVE_FILE_PREFIX,
  DRIVE_STATE_KEY,
  getDriveState,
  loadDriveState,
  resetDriveStateForTests,
  updateDriveState,
} from "../drive/driveBackup";
import * as account from "../drive/googleAccount";
import { serializeTasks } from "../migrations";
import { DEFAULT_SETTINGS, saveSettings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { RemovedTask } from "../hooks/useTasks";
import { TaskActions, TasksProvider, TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { getSyncStatus, resetSyncControllerForTests } from "../sync/controller";
import { DEFAULT_SYNC_STATE, SYNC_STATE_KEY } from "../sync/engine";
import { resetTombstonesForTests } from "../sync/localChanges";
import { EMPTY_SYNC_DATA } from "../sync/merge";
import { buildSyncFile, COPY_PREFIX, parseSyncFile, SYNC_FILE_NAME } from "../sync/syncFile";
import { createFakeDrive, FakeDrive } from "../testing/fakeDrive";
import { makeTask } from "../testing/makeTask";
import { METRICS } from "../testing/metrics";
import { Task } from "../types";

// Synchronisation Google Drive côté écrans : connexion et choix, Réglages, icône nuage,
// déclencheurs automatiques. Google Drive est simulé derrière fetch (src/testing/fakeDrive).

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
jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
const mocked = account as jest.Mocked<typeof account>;

const HOUR = 60 * 60 * 1000;
let fake: FakeDrive;

let actions: TaskActions;
let tasksState: TasksState;
function Grab() {
  actions = useTaskActions();
  tasksState = useTasksSelector((s) => s);
  return null;
}

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};

const renderApp = async ({ settings = true, cloud = false } = {}) => {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Grab />
        {settings && <SettingsScreen />}
        {cloud && <CloudButton />}
        <DriveSync />
      </TasksProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(tasksState.isLoaded).toBe(true));
  await flush();
};

let alerts: { title: string; message?: string; buttons?: AlertButton[]; options?: AlertOptions }[];
const pressAlertButton = async (label: string) => {
  const button = alerts.at(-1)!.buttons!.find((b) => b.text === label)!;
  await act(async () => {
    await button.onPress?.();
  });
  await flush();
};
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flush();
};

const scheduledTaskIds = () =>
  (Notifications as unknown as { __state: { scheduled: { content: { data: { taskId?: string } } }[] } }).__state.scheduled
    .map((n) => n.content.data.taskId)
    .filter((id) => id !== undefined);

const localTasks = [makeTask({ id: "local", title: "Tâche du téléphone", category: "UI", updatedAt: Date.now() })];
const remoteTasks = [
  makeTask({
    id: "a",
    title: "Préparer le budget",
    category: "INU",
    dueAt: Date.now() + 10 * 24 * HOUR,
    reminderOffset: 60,
    modifiedAt: Date.now() - HOUR,
  }),
  makeTask({ id: "b", title: "Compte rendu", category: "NDNI", modifiedAt: Date.now() - HOUR }),
];

// Fichier actuel déjà écrit par un autre téléphone
const putSyncFile = (tasks: Task[] = remoteTasks, settings = { ...DEFAULT_SETTINGS, onboardingDone: true, autoArchive: false }) =>
  fake.seed(SYNC_FILE_NAME, buildSyncFile({ ...EMPTY_SYNC_DATA, tasks }, settings, Date.now() - HOUR), {
    tasks: String(tasks.length),
  });
// Sauvegarde de la 1.5
const putLegacyBackup = (createdAt: number, tasks: Task[] = remoteTasks) =>
  fake.seed(
    `${DRIVE_FILE_PREFIX}${createdAt}.json`,
    JSON.stringify(buildBackup({ tasks, settings: { ...DEFAULT_SETTINGS, onboardingDone: true }, completions: [], reviewWeeks: [] }, createdAt)),
    { createdAt: String(createdAt), tasks: String(tasks.length) }
  );
const currentIds = () => {
  const files = fake.filesNamed(SYNC_FILE_NAME);
  expect(files).toHaveLength(1);
  const parsed = parseSyncFile(fake.contentOf(files[0]));
  return parsed.ok ? parsed.file.data.tasks.map((t) => t.id).sort() : null;
};
const writes = () => fake.state.requests.filter((r) => r.method === "POST" || r.method === "PATCH");
const connected = () => updateDriveState({ account: "lea@example.com", autoBackup: true });

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveStateForTests();
  resetSyncControllerForTests();
  resetTombstonesForTests();
  fake = createFakeDrive();
  globalThis.fetch = fake.fetch as unknown as typeof fetch;
  mocked.signIn.mockReset().mockResolvedValue("lea@example.com");
  mocked.accessToken.mockReset().mockResolvedValue("jeton-1");
  mocked.signOut.mockClear();
  alerts = [];
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons, options) => {
    alerts.push({ title, message, buttons, options });
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(localTasks));
  await saveSettings({ ...DEFAULT_SETTINGS, onboardingDone: true, weeklyReview: false });
});
afterEach(() => {
  resetSyncControllerForTests();
  jest.restoreAllMocks();
});

describe("sans connexion", () => {
  it("bouton de connexion, aucune requête au lancement", async () => {
    await renderApp();
    expect(screen.getByRole("button", { name: "Synchroniser avec Google Drive" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Synchroniser maintenant" })).toBeNull();
    expect(screen.getByRole("button", { name: "Exporter mes données" })).toBeOnTheScreen();
    expect(fake.state.requests).toEqual([]);
    expect(mocked.accessToken).not.toHaveBeenCalled();
    expect(getSyncStatus().phase).toBe("off");
  });

  it("« i » de la section : dossier caché, réglages propres à chaque téléphone, version la plus récente", async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText("En savoir plus : Synchronisation Google Drive"));
    expect(screen.getByText(/pas même le développeur/)).toBeOnTheScreen();
    expect(screen.getByText(/Les réglages restent propres à chaque téléphone/)).toBeOnTheScreen();
    expect(screen.getByText(/version la plus récente \(d'après l'heure des téléphones\)/)).toBeOnTheScreen();
  });
});

describe("connexion", () => {
  it("rien en ligne : les tâches du téléphone sont envoyées, sans question", async () => {
    await renderApp();
    await press("Synchroniser avec Google Drive");
    expect(alerts).toEqual([]);
    expect(currentIds()).toEqual(["local"]);
    expect(screen.getByText("Compte : lea@example.com")).toBeOnTheScreen();
    expect(screen.getByText(/^Synchronisé : /)).toBeOnTheScreen();
    expect(screen.getByRole("switch", { name: "Synchronisation automatique" }).props.value).toBe(true);
    // Fichier dans le dossier caché de l'app, copie du jour comprise
    for (const f of fake.state.files.values()) expect(f.parents).toEqual(["appDataFolder"]);
    expect(fake.filesNamed(COPY_PREFIX)).toHaveLength(1);
  });

  it("connexion annulée : rien ne change", async () => {
    mocked.signIn.mockResolvedValueOnce(null);
    await renderApp();
    await press("Synchroniser avec Google Drive");
    expect(getDriveState().account).toBeNull();
    expect(fake.state.requests).toEqual([]);
  });

  it("échec de la connexion : un message, pas de compte", async () => {
    mocked.signIn.mockRejectedValueOnce(new Error("DEVELOPER_ERROR"));
    await renderApp();
    await press("Synchroniser avec Google Drive");
    expect(alerts.at(-1)!.title).toBe("Connexion impossible");
    expect(getDriveState().account).toBeNull();
  });

  it("téléphone vide : tout est récupéré d'office (réglages compris), un seul message daté", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([]));
    putSyncFile();
    await renderApp();
    await press("Synchroniser avec Google Drive");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b"]));
    expect(alerts.map((a) => a.title)).toEqual(["Tâches restaurées"]);
    expect(actions.getSettings().autoArchive).toBe(false);
    // Notifications programmées pour les tâches reçues
    await waitFor(() => expect(scheduledTaskIds()).toContain("a"));
  });

  it("téléphone vide, sauvegarde de la 1.5 en ligne : récupérée, puis l'actuel est créé", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, serializeTasks([]));
    putLegacyBackup(new Date(2026, 10, 2, 9, 0).getTime());
    await renderApp();
    await press("Synchroniser avec Google Drive");
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b"]));
    expect(alerts[0].message).toBe("Tes tâches ont été restaurées (sauvegarde du 2 nov.).");
    expect(currentIds()).toEqual(["a", "b"]);
  });

  describe("données des deux côtés", () => {
    const ask = async () => {
      putSyncFile();
      await renderApp();
      await press("Synchroniser avec Google Drive");
      return alerts.at(-1)!;
    };

    it("trois choix, sans fermeture possible ; rien n'est synchronisé avant le choix", async () => {
      const choice = await ask();
      expect(choice.title).toBe("Des tâches des deux côtés");
      expect(choice.message).toContain("Google Drive : 2 tâches. Ce téléphone : 1 tâche.");
      expect(choice.buttons!.map((b) => b.text)).toEqual([
        "Garder ce téléphone",
        "Remplacer par Google Drive",
        "Fusionner (recommandé)",
      ]);
      expect(choice.options?.cancelable).toBe(false);
      // Une modification pendant ce temps ne déclenche rien
      await act(async () => actions.addTask({ title: "Nouvelle", category: "UI" }));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(writes()).toEqual([]);
      expect(tasksState.tasks.some((t) => t.id === "a")).toBe(false);
    });

    it("« Fusionner » : tout est gardé, sur le téléphone et en ligne", async () => {
      await ask();
      await pressAlertButton("Fusionner (recommandé)");
      await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b", "local"]));
      expect(currentIds()).toEqual(["a", "b", "local"]);
      expect(actions.getSettings().autoArchive).toBe(DEFAULT_SETTINGS.autoArchive); // réglages d'ici
      await waitFor(() => expect(scheduledTaskIds()).toContain("a"));
    });

    it("« Remplacer par Google Drive » : copie de secours, puis les données en ligne", async () => {
      await ask();
      await pressAlertButton("Remplacer par Google Drive");
      await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b"]));
      expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toContain("Tâche du téléphone");
      expect(currentIds()).toEqual(["a", "b"]);
    });

    it("« Garder ce téléphone » : l'actuel ne contient plus que ses tâches", async () => {
      await ask();
      await pressAlertButton("Garder ce téléphone");
      expect(currentIds()).toEqual(["local"]);
      expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
    });
  });
});

describe("Réglages, une fois connecté", () => {
  it("« Synchroniser maintenant » reçoit les changements d'un autre téléphone", async () => {
    await connected();
    await renderApp();
    expect(currentIds()).toEqual(["local"]); // synchronisé à l'ouverture
    // Un autre téléphone ajoute une tâche
    const file = fake.filesNamed(SYNC_FILE_NAME)[0];
    const parsed = parseSyncFile(fake.contentOf(file));
    if (!parsed.ok) throw new Error();
    file.revisions.push({
      id: "rev-ailleurs",
      content: buildSyncFile({ ...parsed.file.data, tasks: [...parsed.file.data.tasks, remoteTasks[1]] }, null, Date.now()),
      modifiedTime: new Date().toISOString(),
    });
    await press("Synchroniser maintenant");
    expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["b", "local"]);
    expect(alerts).toEqual([]);
  });

  it("hors ligne : message, état « Hors ligne », données intactes", async () => {
    await connected();
    await renderApp();
    fake.state.offline = true;
    await press("Synchroniser maintenant");
    expect(alerts.at(-1)!.title).toBe("Synchronisation impossible");
    expect(screen.getByText("Hors ligne : nouvel essai plus tard")).toBeOnTheScreen();
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
  });

  it("fichier d'une version plus récente : message de mise à jour, rien n'est écrasé", async () => {
    await connected();
    fake.seed(SYNC_FILE_NAME, JSON.stringify({ app: "dofirst", kind: "sync", syncVersion: 99 }));
    await renderApp();
    expect(screen.getByText(/^Mets DoFirst à jour/)).toBeOnTheScreen();
    await press("Synchroniser maintenant");
    expect(alerts.at(-1)!.title).toBe("Mise à jour nécessaire");
    expect(fake.state.requests.some((r) => r.method === "PATCH")).toBe(false);
  });

  it("accès retiré pendant une synchronisation automatique : compte oublié, sans message", async () => {
    await connected();
    mocked.accessToken.mockRejectedValue(new account.NotSignedInError("Session expirée"));
    await renderApp();
    expect(getDriveState().account).toBeNull();
    expect(alerts).toEqual([]);
    expect(screen.getByRole("button", { name: "Synchroniser avec Google Drive" })).toBeOnTheScreen();
  });

  it("copies : liste, retour à l'une d'elles sur ce téléphone et en ligne (copie de secours gardée)", async () => {
    await connected();
    fake.seed(`${COPY_PREFIX}2026-11-01.json`, buildSyncFile({ ...EMPTY_SYNC_DATA, tasks: [remoteTasks[1]] }, null, Date.now() - 48 * HOUR), {
      tasks: "1",
    });
    await renderApp();
    await press("Revenir à une copie…");
    const rows = screen.getAllByRole("button", { name: /· 1 tâche$/ });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await fireEvent.press(rows.at(-1)!);
    await flush();
    expect(alerts.at(-1)!.title).toBe("Revenir à cette copie ?");
    await pressAlertButton("Revenir à cette copie");
    expect(alerts.at(-1)!.title).toBe("Copie rétablie");
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["b"]);
    expect(currentIds()).toEqual(["b"]);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toContain("Tâche du téléphone");
  });

  it("déconnexion : confirmation, compte et état oubliés, données gardées des deux côtés", async () => {
    await connected();
    await renderApp();
    await press("Se déconnecter");
    expect(alerts.at(-1)!.title).toBe("Se déconnecter de Google Drive ?");
    await pressAlertButton("Se déconnecter");
    expect(mocked.signOut).toHaveBeenCalledTimes(1);
    expect(getDriveState()).toEqual(DEFAULT_DRIVE_STATE);
    expect(JSON.parse((await AsyncStorage.getItem(SYNC_STATE_KEY))!)).toEqual(DEFAULT_SYNC_STATE);
    expect(currentIds()).toEqual(["local"]);
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
    fake.state.requests = [];
    await act(async () => actions.addTask({ title: "Après", category: "UI" }));
    await flush();
    expect(fake.state.requests).toEqual([]);
  });

  it("suppression des données en ligne : tout disparaît du Drive, synchronisation automatique coupée", async () => {
    await connected();
    putLegacyBackup(Date.now() - 2 * HOUR);
    await renderApp();
    expect(fake.state.files.size).toBeGreaterThan(1);
    await press("Supprimer mes données en ligne");
    expect(alerts.at(-1)!.title).toBe("Supprimer tes données en ligne ?");
    await pressAlertButton("Supprimer");
    expect(fake.state.files.size).toBe(0);
    expect(alerts.at(-1)!.title).toBe("Données en ligne supprimées");
    expect(getDriveState()).toMatchObject({ account: "lea@example.com", autoBackup: false });
    // Les données du téléphone ne changent pas (sauvegarde de la 1.5 fusionnée à l'ouverture)
    expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b", "local"]);
    // Plus rien n'est renvoyé automatiquement
    fake.state.requests = [];
    await act(async () => actions.addTask({ title: "Après", category: "UI" }));
    await flush();
    expect(fake.state.requests).toEqual([]);
  });
});

describe("migration depuis la 1.5", () => {
  it("téléphone déjà connecté, sauvegarde faite par lui : l'actuel part de ses données, sans rien faire revenir", async () => {
    const createdAt = Date.now() - 2 * HOUR;
    putLegacyBackup(createdAt, [...localTasks, makeTask({ id: "supprimee-depuis" })]);
    await AsyncStorage.setItem(
      DRIVE_STATE_KEY,
      JSON.stringify({ account: "lea@example.com", autoBackup: true, lastBackupAt: createdAt, lastHash: "h", lastAttemptAt: createdAt })
    );
    await renderApp();
    expect(currentIds()).toEqual(["local"]);
    expect(tasksState.tasks.map((t) => t.id)).toEqual(["local"]);
    expect(alerts).toEqual([]);
  });

  it("sauvegarde faite par un autre téléphone : fusionnée sans question, rien n'est perdu", async () => {
    putLegacyBackup(Date.now() - 2 * HOUR);
    await AsyncStorage.setItem(
      DRIVE_STATE_KEY,
      JSON.stringify({ account: "lea@example.com", autoBackup: true, lastBackupAt: 1, lastHash: "h", lastAttemptAt: null })
    );
    await renderApp();
    await waitFor(() => expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["a", "b", "local"]));
    expect(currentIds()).toEqual(["a", "b", "local"]);
  });

  it("état de la 1.5 relu ; un état abîmé redevient l'état par défaut", async () => {
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

describe("bandeau « Annuler » après une synchronisation", () => {
  it("une suppression annulée après l'envoi fait revenir la tâche partout, sans toucher au reste", async () => {
    await connected();
    putSyncFile([remoteTasks[1]]);
    await renderApp();
    await waitFor(() => expect(currentIds()).toEqual(["b", "local"]));
    let removed: RemovedTask[] = [];
    await act(async () => {
      removed = actions.removeTask("local");
    });
    await press("Synchroniser maintenant");
    expect(currentIds()).toEqual(["b"]);
    await act(async () => actions.restoreTasks(removed));
    await press("Synchroniser maintenant");
    expect(currentIds()).toEqual(["b", "local"]);
    expect(tasksState.tasks.map((t) => t.id).sort()).toEqual(["b", "local"]);
  });
});

describe("icône nuage", () => {
  it("non connecté : un appui ouvre la connexion", async () => {
    await renderApp({ settings: false, cloud: true });
    const cloud = screen.getByTestId("cloud-button");
    expect(cloud.props.accessibilityLabel).toBe("Google Drive : non connecté. Toucher pour synchroniser");
    await fireEvent.press(cloud);
    await flush();
    expect(mocked.signIn).toHaveBeenCalledTimes(1);
    expect(currentIds()).toEqual(["local"]);
  });

  it("synchronisé : heure affichée ; un appui montre l'état et « Synchroniser maintenant »", async () => {
    await connected();
    await renderApp({ settings: false, cloud: true });
    const cloud = screen.getByTestId("cloud-button");
    expect(cloud.props.accessibilityLabel).toMatch(/^Google Drive : synchronisé, /);
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeOnTheScreen();
    await fireEvent.press(cloud);
    const sheet = alerts.at(-1)!;
    expect(sheet.title).toBe("Google Drive");
    expect(sheet.message).toMatch(/^Compte : lea@example.com\nSynchronisé : /);
    expect(sheet.buttons!.map((b) => b.text)).toEqual(["Fermer", "Réglages", "Synchroniser maintenant"]);
    fake.state.requests = [];
    await pressAlertButton("Synchroniser maintenant");
    expect(fake.state.requests.length).toBeGreaterThan(0);
  });

  it("hors ligne : icône « hors ligne », aucun message", async () => {
    await connected();
    fake.state.offline = true;
    await renderApp({ settings: false, cloud: true });
    expect(screen.getByTestId("cloud-button").props.accessibilityLabel).toBe(
      "Google Drive : hors ligne, nouvel essai plus tard"
    );
    expect(alerts).toEqual([]);
  });
});
