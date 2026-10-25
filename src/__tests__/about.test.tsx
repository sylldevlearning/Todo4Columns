import { fireEvent, render, screen } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import React from "react";
import { Alert, Linking, Platform, Share } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import appJson from "../../app.json";
import SettingsScreen from "../../app/settings";
import { TasksProvider } from "../store/TasksContext";
import {
  appVersion,
  feedbackMailUrl,
  FEEDBACK_EMAIL,
  openStoreListing,
  PLAY_STORE_URL,
  sendFeedback,
  shareApp,
  systemVersion,
} from "../community";
import SettingsForm from "../components/SettingsForm";
import { en } from "../i18n/en";
import { DEFAULT_SETTINGS } from "../settings";

// Dans l'app, la configuration (app.json) est intégrée au build ; Jest ne la fournit pas
jest.mock("expo-constants", () => ({ expoConfig: { version: require("../../app.json").expo.version } }));

// Promesses en attente (renderRouter active les minuteurs simulés : pas de setImmediate)
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let openURL: jest.SpyInstance;
let share: jest.SpyInstance;
beforeEach(() => {
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  openURL.mockClear();
  share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  share.mockClear();
});

describe("Réglages › À propos", () => {
  const renderForm = async (about = { version: "1.2.1", onRate: jest.fn(), onShare: jest.fn(), onFeedback: jest.fn() }) => {
    await render(
      <SettingsForm
        settings={DEFAULT_SETTINGS}
        onChange={() => {}}
        permission="granted"
        onRequestPermission={() => {}}
        onOpenSystemSettings={() => {}}
        archivedTasks={[]}
        onRestore={() => {}}
        onDeleteForever={() => {}}
        about={about}
      />
    );
    return about;
  };

  it("noter, partager, écrire, numéro de version", async () => {
    const about = await renderForm();
    expect(screen.getByRole("header", { name: "À propos" })).toBeOnTheScreen();
    expect(screen.getByText("Version 1.2.1")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Noter DoFirst" }));
    expect(about.onRate).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Partager DoFirst" }));
    expect(about.onShare).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Suggérer une idée / signaler un problème" }));
    expect(about.onFeedback).toHaveBeenCalled();
  });

  it("version de l'app : celle d'app.json", () => {
    expect(appVersion()).toBe(appJson.expo.version);
  });

  it("dans l'écran Réglages : version affichée, « Noter DoFirst » ouvre la fiche", async () => {
    await renderRouter(
      {
        _layout: () => (
          <SafeAreaProvider
            initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
          >
            <TasksProvider>
              <Slot />
            </TasksProvider>
          </SafeAreaProvider>
        ),
        settings: SettingsScreen,
      },
      { initialUrl: "/settings" }
    );
    expect(await screen.findByText(`Version ${appJson.expo.version}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Noter DoFirst" }));
    await flush();
    expect(openURL).toHaveBeenCalledWith("market://details?id=com.saloum.sylla.matriceeisenhower");
    await fireEvent.press(screen.getByRole("button", { name: "Partager DoFirst" }));
    expect(share).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Suggérer une idée / signaler un problème" }));
    await flush();
    expect(openURL).toHaveBeenLastCalledWith(feedbackMailUrl());
  });
});

describe("noter DoFirst", () => {
  it("ouvre la fiche dans le Play Store", async () => {
    openStoreListing();
    await flush();
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith("market://details?id=com.saloum.sylla.matriceeisenhower");
  });

  it("sans l'app Play Store : la page web de la fiche", async () => {
    openURL.mockRejectedValueOnce(new Error("aucune app"));
    openStoreListing();
    await flush();
    expect(openURL).toHaveBeenLastCalledWith(
      "https://play.google.com/store/apps/details?id=com.saloum.sylla.matriceeisenhower"
    );
  });
});

describe("partager DoFirst", () => {
  it("partage natif avec un court message et le lien Play Store", async () => {
    await shareApp();
    expect(share).toHaveBeenCalledWith({
      message:
        "J'utilise DoFirst pour trier mes tâches entre l'urgent et l'important. Essaie-la : " +
        "https://play.google.com/store/apps/details?id=com.saloum.sylla.matriceeisenhower",
    });
    expect(PLAY_STORE_URL).toBe("https://play.google.com/store/apps/details?id=com.saloum.sylla.matriceeisenhower");
  });
});

describe("suggérer une idée / signaler un problème", () => {
  const parse = (url: string): Record<string, string> => {
    const [address, query] = url.split("?");
    const params = Object.fromEntries(
      query.split("&").map((p) => p.split("=")).map(([k, v]) => [k, decodeURIComponent(v)])
    );
    return { address, ...params };
  };

  it("e-mail prérempli : adresse, objet, versions de l'app et du système", () => {
    const mail = parse(feedbackMailUrl());
    expect(mail.address).toBe(`mailto:${FEEDBACK_EMAIL}`);
    expect(mail.subject).toBe("DoFirst : idée ou problème");
    expect(mail.body).toBe(`\n\n\n---\nDoFirst ${appVersion()}\n${systemVersion()}`);
  });

  it("version d'Android lue sur le téléphone", () => {
    const os = jest.replaceProperty(Platform, "OS", "android");
    const version = jest.spyOn(Platform, "Version", "get").mockReturnValue(34);
    const constants = jest
      .spyOn(Platform, "constants", "get")
      .mockReturnValue({ Release: "14" } as typeof Platform.constants);
    expect(systemVersion()).toBe("Android 14 (API 34)");
    expect(parse(feedbackMailUrl()).body).toContain("Android 14 (API 34)");
    os.restore();
    version.mockRestore();
    constants.mockRestore();
  });

  it("ouvre l'app de messagerie ; sans elle, l'adresse est affichée", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    sendFeedback();
    await flush();
    expect(openURL).toHaveBeenCalledWith(feedbackMailUrl());
    expect(alert).not.toHaveBeenCalled();

    openURL.mockRejectedValueOnce(new Error("aucune app"));
    sendFeedback();
    await flush();
    expect(alert).toHaveBeenCalledWith("Aucune app de messagerie", `Tu peux écrire à ${FEEDBACK_EMAIL}.`);
    alert.mockClear();
  });
});

describe("textes anglais", () => {
  it("À propos", () => {
    expect(en.about.section).toBe("About");
    expect(en.about.rate).toBe("Rate DoFirst");
    expect(en.about.share).toBe("Share DoFirst");
    expect(en.about.feedback).toBe("Suggest an idea / report a problem");
    expect(en.about.shareMessage("URL")).toBe(
      "I use DoFirst to sort my tasks between urgent and important. Give it a try: URL"
    );
    expect(en.about.version("1.2.1")).toBe("Version 1.2.1");
  });
});
