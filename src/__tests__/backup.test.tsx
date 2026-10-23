import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import React from "react";
import { Alert, AlertButton } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SettingsScreen from "../../app/settings";
import {
  BACKUP_VERSION,
  backupFileName,
  buildBackup,
  parseBackup,
  PRE_IMPORT_BACKUP_KEY,
  removeExportedFiles,
} from "../backup";
import { COMPLETION_LOG_KEY, saveLog } from "../completionLog";
import { useBackup } from "../hooks/useBackup";
import { serializeTasks } from "../migrations";
import { loadReviewWeeks, REVIEW_LOG_KEY } from "../review";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from "../settings";
import { STORAGE_KEY } from "../storage";
import { TaskActions, TasksProvider, TasksState, useTaskActions, useTasksSelector } from "../store/TasksContext";
import { makeTask } from "../testing/makeTask";

// Système de fichiers en mémoire
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    static pickFileAsync = jest.fn();
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
    }
    create() {}
    write(content: string) {
      files.set(this.uri, content);
    }
    async text() {
      if (!files.has(this.uri)) throw new Error("Fichier absent");
      return files.get(this.uri)!;
    }
    get name() {
      return this.uri.split("/").pop()!;
    }
    delete() {
      files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(dir: { uri: string }) {
      this.uri = dir.uri;
    }
    list() {
      return [...files.keys()].filter((k) => k.startsWith(this.uri + "/")).map((k) => new File(k));
    }
  }
  return { File, Directory, Paths: { cache: { uri: "file:///cache" } }, __files: files };
});
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn(async () => {}) }));

const files: Map<string, string> = require("expo-file-system").__files;
const mockPick = require("expo-file-system").File.pickFileAsync as jest.Mock;
const scheduled = () =>
  (Notifications as unknown as { __state: { scheduled: { content: { data: { taskId?: string } } }[] } }).__state
    .scheduled;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 40, left: 0, right: 0, bottom: 20 },
};
const HOUR = 60 * 60 * 1000;

let actions: TaskActions;
let backup: ReturnType<typeof useBackup>;
let state: TasksState;
function Grab() {
  actions = useTaskActions();
  backup = useBackup();
  state = useTasksSelector((s) => s);
  return null;
}

const launch = async () => {
  const result = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TasksProvider>
        <Grab />
      </TasksProvider>
    </SafeAreaProvider>
  );
  await waitFor(() => expect(state.isLoaded).toBe(true));
  await act(async () => {});
  await act(async () => {});
  return result;
};

// Fichier choisi dans le sélecteur
const pickFile = (content: string) => {
  files.set("file:///picked.json", content);
  const { File } = require("expo-file-system");
  mockPick.mockResolvedValueOnce({ canceled: false, result: new File("file:///picked.json") });
};

let alerts: { title: string; message?: string; buttons?: AlertButton[] }[];

const currentTasks = [
  makeTask({ id: "old", title: "Ancienne tâche", category: "UI", nagInterval: 30, updatedAt: Date.now() }),
];

beforeEach(async () => {
  await AsyncStorage.clear();
  files.clear();
  mockPick.mockReset();
  (Sharing.shareAsync as jest.Mock).mockClear();
  alerts = [];
  jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
    alerts.push({ title, message, buttons });
  });
  await AsyncStorage.setItem(STORAGE_KEY, serializeTasks(currentTasks));
  await saveSettings({ ...DEFAULT_SETTINGS, doNagInterval: 30, weeklyReview: false });
});

const pressAlertButton = async (label: string) => {
  const button = alerts.at(-1)!.buttons!.find((b) => b.text === label)!;
  await act(async () => {
    await button.onPress?.();
  });
};

// Sauvegarde exportée par une autre installation
const importedTasks = [
  makeTask({ id: "a", title: "Préparer le budget", category: "INU", dueAt: Date.now() + 10 * 24 * HOUR, notificationIds: ["ailleurs"] }),
  makeTask({ id: "b", title: "Compte rendu", category: "UDI", nagInterval: 60, updatedAt: Date.now(), delegatedTo: "Marie" }),
];
const validFile = (createdAt: number) =>
  JSON.stringify(
    buildBackup(
      {
        tasks: importedTasks,
        settings: { ...DEFAULT_SETTINGS, quietHoursStart: "21:00", weeklyReview: false, onboardingDone: true },
        completions: [{ date: Date.now() - HOUR, category: "INU" }],
        reviewWeeks: ["2026-10-12"],
      },
      createdAt
    )
  );

describe("export", () => {
  it("fichier complet : tâches, réglages, journal et revues, ouvert dans le partage", async () => {
    await saveLog([{ date: Date.now() - HOUR, category: "UI" }]);
    await AsyncStorage.setItem(REVIEW_LOG_KEY, JSON.stringify({ schemaVersion: 1, weeks: ["2026-10-19"] }));
    await launch();

    await act(() => backup.exportData());

    const name = backupFileName(Date.now(), "dofirst-sauvegarde");
    expect(name).toMatch(/^dofirst-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    const uri = `file:///cache/${name}`;
    expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: "application/json" }));

    const file = JSON.parse(files.get(uri)!);
    expect(file).toMatchObject({ app: "dofirst", backupVersion: BACKUP_VERSION });
    expect(file.tasks.schemaVersion).toBe(6);
    expect(file.tasks.tasks).toHaveLength(1);
    expect(file.tasks.tasks[0]).toMatchObject({ id: "old", title: "Ancienne tâche", notificationIds: [] });
    expect(file.settings.settings).toMatchObject({ doNagInterval: 30 });
    expect(file.completionLog).toEqual([{ date: expect.any(Number), category: "UI" }]);
    expect(file.reviewWeeks).toEqual(["2026-10-19"]);
    // Le fichier exporté se réimporte tel quel
    expect(parseBackup(files.get(uri)!).ok).toBe(true);
  });

  it("le fichier exporté n'est pas supprimé pendant le partage, mais au lancement suivant ou au prochain export", async () => {
    await launch();
    files.set("file:///cache/autre.txt", "à garder");
    files.set("file:///cache/dofirst-sauvegarde-2026-01-01.json", "ancien export");

    await act(() => backup.exportData());
    const exported = [...files.keys()].filter((k) => k.includes("dofirst-"));
    // L'ancien export est retiré, le nouveau reste le temps que l'appli choisie le lise
    expect(exported).toEqual([`file:///cache/${backupFileName(Date.now(), "dofirst-sauvegarde")}`]);

    // Lancement suivant : plus aucun fichier exporté dans le cache, les autres fichiers restent
    removeExportedFiles();
    expect([...files.keys()]).toEqual(["file:///cache/autre.txt"]);
  });

  it("nom du fichier daté du jour", () => {
    expect(backupFileName(new Date(2026, 9, 3).getTime(), "dofirst-sauvegarde")).toBe(
      "dofirst-sauvegarde-2026-10-03.json"
    );
  });

  it("échec : un message, rien d'autre", async () => {
    await launch();
    (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error("refusé"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await act(() => backup.exportData());
    expect(alerts.at(-1)!.title).toBe("Export impossible");
  });
});

describe("import", () => {
  it("valide : aperçu, confirmation, copie de secours, remplacement et notifications reprogrammées", async () => {
    await launch();
    await waitFor(() => expect(scheduled().map((n) => n.content.data.taskId)).toContain("old"));
    const before = await AsyncStorage.getItem(STORAGE_KEY);

    const createdAt = new Date(new Date().getFullYear(), 9, 12, 10).getTime();
    pickFile(validFile(createdAt));
    await act(() => backup.importData());

    // Sélecteur du système, sans permission de stockage
    expect(mockPick).toHaveBeenCalledWith({ mimeTypes: expect.arrayContaining(["application/json"]) });
    expect(alerts.at(-1)!.title).toBe("Importer cette sauvegarde ?");
    expect(alerts.at(-1)!.message).toContain("2 tâches, sauvegarde du 12 oct.");
    // Rien n'est touché avant la confirmation
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toBeNull();

    await pressAlertButton("Remplacer");

    // Copie de secours des données d'avant
    const copy = JSON.parse((await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY))!);
    expect(copy.data[STORAGE_KEY]).toBe(before);
    expect(JSON.parse(copy.data[SETTINGS_KEY]).settings.doNagInterval).toBe(30);

    // Données remplacées, en mémoire et en stockage
    expect(state.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(state.completions).toEqual([{ date: expect.any(Number), category: "INU" }]);
    expect(actions.getSettings().quietHoursStart).toBe("21:00");
    expect((await loadSettings()).quietHoursStart).toBe("21:00");
    expect(await loadReviewWeeks()).toEqual(["2026-10-12"]);
    expect(JSON.parse((await AsyncStorage.getItem(COMPLETION_LOG_KEY))!).entries).toHaveLength(1);
    expect(alerts.at(-1)).toMatchObject({ title: "Sauvegarde importée", message: "2 tâches restaurées." });

    // Notifications : celles des tâches importées, plus aucune de l'ancienne
    await waitFor(() => {
      const ids = scheduled().map((n) => n.content.data.taskId);
      expect(ids).not.toContain("old");
      expect(ids).toEqual(expect.arrayContaining(["a", "b"]));
    });
  });

  it("ancien schéma : passe par les migrations (dates de fin, journal repris)", async () => {
    await launch();
    const old = JSON.stringify({
      app: "dofirst",
      backupVersion: 1,
      createdAt: Date.now(),
      tasks: {
        schemaVersion: 4,
        tasks: [{ id: "v4", title: "Faite il y a peu", category: "INU", isDone: true, updatedAt: Date.now() - HOUR }],
      },
      settings: { schemaVersion: 1, settings: { doNagInterval: 120 } },
    });
    pickFile(old);
    await act(() => backup.importData());
    await pressAlertButton("Remplacer");

    expect(state.tasks[0]).toMatchObject({ id: "v4", completedAt: expect.any(Number), recurrence: null });
    expect(state.completions).toEqual([{ date: state.tasks[0].completedAt, category: "INU" }]);
    expect(actions.getSettings()).toMatchObject({ doNagInterval: 120, celebrations: true });
  });

  it.each([
    ["pas du JSON", "{abîmé"],
    ["un autre fichier JSON", JSON.stringify({ hello: "world" })],
    ["sans tâches", JSON.stringify({ app: "dofirst", backupVersion: 1 })],
  ])("invalide (%s) : refusé avec un message clair, rien n'est touché", async (_, content) => {
    await launch();
    const before = await AsyncStorage.getItem(STORAGE_KEY);
    pickFile(content);
    await act(() => backup.importData());

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      title: "Fichier non reconnu",
      message: "Ce fichier n'est pas une sauvegarde DoFirst valide. Rien n'a été modifié.",
    });
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toBeNull();
    expect(state.tasks.map((t) => t.id)).toEqual(["old"]);
  });

  it("plus récent : refusé avec un message clair, rien n'est touché", async () => {
    await launch();
    const before = await AsyncStorage.getItem(STORAGE_KEY);
    pickFile(JSON.stringify({ app: "dofirst", backupVersion: 1, tasks: { schemaVersion: 99, tasks: [] } }));
    await act(() => backup.importData());
    expect(alerts[0]).toMatchObject({ title: "Sauvegarde trop récente" });
    expect(alerts[0].message).toContain("Rien n'a été modifié.");

    pickFile(JSON.stringify({ app: "dofirst", backupVersion: 2, tasks: { schemaVersion: 6, tasks: [] } }));
    await act(() => backup.importData());
    expect(alerts[1]).toMatchObject({ title: "Sauvegarde trop récente" });
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("annulation dans le sélecteur ou à la confirmation : rien ne change", async () => {
    await launch();
    const before = await AsyncStorage.getItem(STORAGE_KEY);

    mockPick.mockResolvedValueOnce({ canceled: true, result: null });
    await act(() => backup.importData());
    expect(alerts).toHaveLength(0);

    pickFile(validFile(Date.now()));
    await act(() => backup.importData());
    await pressAlertButton("Annuler");
    expect(state.tasks.map((t) => t.id)).toEqual(["old"]);
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toBeNull();
  });
});

describe("« Annuler le dernier import »", () => {
  const importValid = async () => {
    pickFile(validFile(Date.now()));
    await act(() => backup.importData());
    await pressAlertButton("Remplacer");
  };

  it("sans import : rien à annuler", async () => {
    await launch();
    expect(backup.canUndoImport).toBe(false);
  });

  it("confirmation, données d'avant restaurées, copie supprimée, notifications reprogrammées", async () => {
    await launch();
    const before = await AsyncStorage.getItem(STORAGE_KEY);
    await importValid();
    expect(backup.canUndoImport).toBe(true);
    await waitFor(() => expect(scheduled().map((n) => n.content.data.taskId)).toEqual(expect.arrayContaining(["a", "b"])));

    await act(() => backup.undoImport());
    expect(alerts.at(-1)!.title).toBe("Annuler le dernier import ?");
    expect(alerts.at(-1)!.message).toMatch(/^Tes données reviennent à leur état d'avant l'import du /);

    await pressAlertButton("Restaurer");
    expect(alerts.at(-1)).toMatchObject({ title: "Import annulé" });
    expect(state.tasks.map((t) => t.id)).toEqual(["old"]);
    expect(actions.getSettings().doNagInterval).toBe(30);
    expect(actions.getSettings().quietHoursStart).toBe(DEFAULT_SETTINGS.quietHoursStart);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEY))!).tasks.map((t: { id: string }) => t.id)).toEqual(
      JSON.parse(before!).tasks.map((t: { id: string }) => t.id)
    );
    expect(await loadReviewWeeks()).toEqual([]);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).toBeNull();
    expect(backup.canUndoImport).toBe(false);
    await waitFor(() => expect(scheduled().map((n) => n.content.data.taskId)).toEqual(["old"]));
  });

  it("« Annuler » dans la confirmation : rien ne change", async () => {
    await launch();
    await importValid();
    await act(() => backup.undoImport());
    await pressAlertButton("Annuler");
    expect(state.tasks.map((t) => t.id)).toEqual(["a", "b"]);
    expect(await AsyncStorage.getItem(PRE_IMPORT_BACKUP_KEY)).not.toBeNull();
  });

  it("copie illisible : message clair, rien n'est modifié", async () => {
    await AsyncStorage.setItem(PRE_IMPORT_BACKUP_KEY, "{abîmée");
    await launch();
    await waitFor(() => expect(backup.canUndoImport).toBe(true));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await act(() => backup.undoImport());
    await pressAlertButton("Restaurer");
    expect(alerts.at(-1)).toMatchObject({ title: "Restauration impossible" });
    expect(state.tasks.map((t) => t.id)).toEqual(["old"]);
  });

  it("le bouton n'apparaît dans les Réglages que si une copie existe", async () => {
    const screenWith = () =>
      render(
        <SafeAreaProvider initialMetrics={METRICS}>
          <TasksProvider>
            <SettingsScreen />
          </TasksProvider>
        </SafeAreaProvider>
      );
    const first = await screenWith();
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Annuler le dernier import" })).toBeNull();
    await first.unmount();

    await AsyncStorage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify({ createdAt: Date.now(), data: {} }));
    await screenWith();
    expect(await screen.findByRole("button", { name: "Annuler le dernier import" })).toBeOnTheScreen();
  });
});

describe("section « Sauvegarde » des Réglages", () => {
  it("boutons et « i » qui mentionne la sauvegarde automatique Android", async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TasksProvider>
          <SettingsScreen />
        </TasksProvider>
      </SafeAreaProvider>
    );
    expect(screen.getByRole("button", { name: "Exporter mes données" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Importer une sauvegarde" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("En savoir plus : Sauvegarde"));
    expect(screen.getByText(/sauvegarde automatique de Google/)).toBeOnTheScreen();
    expect(screen.getByText(/fichier non chiffré/)).toBeOnTheScreen();
  });

  it("sauvegarde automatique Android activée dans app.json", () => {
    expect(require("../../app.json").expo.android.allowBackup).toBe(true);
  });
});
