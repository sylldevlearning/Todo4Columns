"use no memo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { requestWidgetUpdate, type WidgetRepresentation } from "react-native-android-widget";
import { setLanguagePreference } from "../i18n";
import { parseStoredTasks } from "../migrations";
import { loadSettings, Settings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { Scheme } from "../theme";
import { Task } from "../types";
import { doWidgetData, matrixWidgetData, todayWidgetData } from "./data";
import { widgetPalette } from "./palette";
import { DoWidget, MatrixWidget, TodayWidget } from "./Widgets";

// Noms des widgets (app.json › react-native-android-widget) : NE PAS MODIFIER, ils désignent
// les widgets déjà posés sur l'écran d'accueil
export const WIDGET_NAMES = ["DoFirstDo", "DoFirstToday", "DoFirstMatrix"] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

export interface WidgetSource {
  tasks: Task[];
  settings: Settings;
  now: number;
}

// Rendu d'un widget pour sa taille (dp), dans le thème choisi dans l'app ; en automatique, les
// deux versions (Android affiche celle du thème du téléphone, et en change avec lui)
export function renderWidget(name: string, size: { width: number; height: number }, source: WidgetSource): WidgetRepresentation {
  const appearance = source.settings.appearance;
  if (appearance === "auto") {
    return { light: renderIn(name, size, source, "light"), dark: renderIn(name, size, source, "dark") };
  }
  return renderIn(name, size, source, appearance);
}

function renderIn(name: string, size: { width: number; height: number }, source: WidgetSource, scheme: Scheme): React.JSX.Element {
  const palette = widgetPalette(scheme);
  switch (name) {
    case "DoFirstToday":
      return <TodayWidget items={todayWidgetData(source.tasks, source.now)} palette={palette} height={size.height} now={source.now} />;
    case "DoFirstMatrix":
      return <MatrixWidget cases={matrixWidgetData(source.tasks)} palette={palette} height={size.height} />;
    default:
      return <DoWidget data={doWidgetData(source.tasks)} palette={palette} height={size.height} />;
  }
}

// Données enregistrées (app fermée) ; la langue des widgets suit le réglage de l'app
export async function readStoredSource(now: number = Date.now()): Promise<WidgetSource> {
  const [json, settings] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY), loadSettings()]);
  setLanguagePreference(settings.language);
  let tasks: Task[] = [];
  try {
    tasks = parseStoredTasks(json, now).tasks;
  } catch {
    tasks = [];
  }
  return { tasks, settings, now };
}

// Redessine tous les widgets posés (aucun : rien n'est fait)
export async function refreshWidgets(source: WidgetSource, names: readonly string[] = WIDGET_NAMES): Promise<void> {
  await Promise.all(
    names.map((widgetName) =>
      requestWidgetUpdate({ widgetName, renderWidget: (info) => renderWidget(widgetName, info, source) }).catch((e) =>
        console.warn("Mise à jour du widget impossible :", widgetName, e)
      )
    )
  );
}
