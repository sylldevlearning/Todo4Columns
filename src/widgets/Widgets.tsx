"use no memo";
import React from "react";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { formatDay } from "../format";
import { t } from "../i18n";
import { Category } from "../types";
import { QuadrantSummary, TodayItem } from "./data";
import { calendarLink, COMPLETE_ACTION, matrixLink, newTaskLink, quadrantLink, taskLink } from "./links";
import { WidgetPalette } from "./palette";

// Rendu des trois widgets (react-native-android-widget : vues natives, pas de hooks).
// Tailles en dp : le contenu s'adapte à la place donnée par le lanceur (redimensionnement).

const ROW = 26; // hauteur d'une ligne de tâche
const HEADER = 34;

const uri = (u: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri: u } }) as const;

const svgCircle = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="2.2"/></svg>`;
const svgPlus = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
const svgMic = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="${color}" stroke-width="2.2"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/></svg>`;

// Nombre de lignes de tâches qui tiennent dans la hauteur restante (au moins 1, au plus max)
export const rowsFor = (height: number, reserved: number, max: number) =>
  Math.max(1, Math.min(max, Math.floor((height - reserved) / ROW)));

function Header({ title, count, color, link }: { title: string; count?: number; color: ColorProp; link: string }) {
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", height: HEADER, width: "match_parent" }} {...uri(link)}>
      <TextWidget text={title} maxLines={1} truncate="END" style={{ fontSize: 15, fontWeight: "700", color }} />
      {count !== undefined && (
        <TextWidget text={`  ${count}`} style={{ fontSize: 15, fontWeight: "700", color }} />
      )}
    </FlexWidget>
  );
}

function IconButton({ svg, link, label, palette }: { svg: string; link: string; label: string; palette: WidgetPalette }) {
  return (
    <FlexWidget
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.surfaceRaised, alignItems: "center", justifyContent: "center", marginLeft: 6 }}
      accessibilityLabel={label}
      {...uri(link)}
    >
      <SvgWidget svg={svg} style={{ width: 18, height: 18 }} />
    </FlexWidget>
  );
}

// Ligne de tâche : rond à cocher (sans ouvrir l'app) et titre (ouvre la fiche)
function TaskRow({
  id,
  title,
  prefix,
  stepId,
  category,
  palette,
  checkable,
}: {
  id: string;
  title: string;
  prefix?: string | null;
  stepId?: string | null;
  category: Category;
  palette: WidgetPalette;
  checkable: boolean;
}) {
  const color = palette.quadrant[category].color;
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", height: ROW, width: "match_parent" }}>
      {checkable && (
        <FlexWidget
          style={{ width: ROW, height: ROW, alignItems: "center", justifyContent: "center" }}
          clickAction={COMPLETE_ACTION}
          clickActionData={{ taskId: id, stepId: stepId ?? null }}
          accessibilityLabel={t.widgets.check(title)}
        >
          <SvgWidget svg={svgCircle(color)} style={{ width: 16, height: 16 }} />
        </FlexWidget>
      )}
      <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center", height: ROW }} {...uri(taskLink(id))}>
        {prefix ? (
          <TextWidget text={`${prefix}  `} style={{ fontSize: 12, fontWeight: "700", color: palette.quadrant[category].textColor }} />
        ) : null}
        <TextWidget text={title} maxLines={1} truncate="END" style={{ fontSize: 13, color: palette.text }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Empty({ text, palette }: { text: string; palette: WidgetPalette }) {
  return <TextWidget text={text} maxLines={2} style={{ fontSize: 13, color: palette.textMuted }} />;
}

const frame = (palette: WidgetPalette) =>
  ({
    width: "match_parent",
    height: "match_parent",
    backgroundColor: palette.bg,
    borderRadius: 22,
    padding: 12,
    flexDirection: "column",
  }) as const;

// « Faire » (2×2) : nombre de tâches, les premières, « + » et micro
export function DoWidget({ data, palette, height }: { data: QuadrantSummary; palette: WidgetPalette; height: number }) {
  const q = palette.quadrant.UI;
  const rows = rowsFor(height, HEADER + 24, 3);
  return (
    <FlexWidget style={frame(palette)} accessibilityLabel={`${CATEGORY_BY_KEY.UI.name}, ${t.matrix.taskCount(data.count)}`}>
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
        <FlexWidget style={{ flex: 1 }}>
          <Header title={CATEGORY_BY_KEY.UI.name} count={data.count} color={q.textColor} link={quadrantLink("UI")} />
        </FlexWidget>
        <IconButton svg={svgPlus(q.color)} link={newTaskLink("UI")} label={t.matrix.newTask} palette={palette} />
        <IconButton svg={svgMic(q.color)} link={newTaskLink("UI", true)} label={t.quick.dictate} palette={palette} />
      </FlexWidget>
      {data.tasks.length === 0 ? (
        <Empty text={t.widgets.nothingToDo} palette={palette} />
      ) : (
        data.tasks.slice(0, rows).map((task) => (
          <TaskRow key={task.id} id={task.id} title={task.title} category="UI" palette={palette} checkable />
        ))
      )}
    </FlexWidget>
  );
}

// « Aujourd'hui » (4×2) : échéances et étapes du jour, avec l'heure si elle est renseignée
export function TodayWidget({
  items,
  palette,
  height,
  now,
}: {
  items: TodayItem[];
  palette: WidgetPalette;
  height: number;
  now: number;
}) {
  const rows = rowsFor(height, HEADER + 24, 8);
  const shown = items.slice(0, rows);
  const hidden = items.length - shown.length;
  return (
    <FlexWidget style={frame(palette)}>
      <Header title={`${t.widgets.today} · ${formatDay(now)}`} color={palette.text} link={calendarLink()} />
      {items.length === 0 ? (
        <Empty text={t.widgets.nothingToday} palette={palette} />
      ) : (
        shown.map((item) => (
          <TaskRow
            key={item.key}
            id={item.taskId}
            stepId={item.stepId}
            title={item.taskTitle ? `${item.title} · ${item.taskTitle}` : item.title}
            prefix={item.time}
            category={item.category}
            palette={palette}
            checkable
          />
        ))
      )}
      {hidden > 0 && <TextWidget text={t.widgets.more(hidden)} style={{ fontSize: 12, color: palette.textMuted }} />}
    </FlexWidget>
  );
}

// « Matrice » (4×4) : les 4 cases, leur nombre de tâches et leurs premières tâches
export function MatrixWidget({
  cases,
  palette,
  height,
}: {
  cases: QuadrantSummary[];
  palette: WidgetPalette;
  height: number;
}) {
  // Chaque case a la moitié de la hauteur (moins l'en-tête de case)
  const rows = rowsFor((height - 24) / 2, 30, 3) >= 3 ? 3 : 2;
  const cell = (summary: QuadrantSummary) => {
    const q = palette.quadrant[summary.category];
    return (
      <FlexWidget
        key={summary.category}
        style={{ flex: 1, height: "match_parent", backgroundColor: q.tint, borderRadius: 16, padding: 8, margin: 3, flexDirection: "column" }}
        accessibilityLabel={`${CATEGORY_BY_KEY[summary.category].name}, ${t.matrix.taskCount(summary.count)}`}
        {...uri(quadrantLink(summary.category))}
      >
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent" }}>
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={CATEGORY_BY_KEY[summary.category].name}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 14, fontWeight: "700", color: q.textColor }}
            />
          </FlexWidget>
          <TextWidget text={String(summary.count)} style={{ fontSize: 14, fontWeight: "700", color: q.textColor }} />
        </FlexWidget>
        {summary.tasks.slice(0, rows).map((task) => (
          <FlexWidget key={task.id} style={{ height: 22, width: "match_parent", justifyContent: "center" }} {...uri(taskLink(task.id))}>
            <TextWidget text={task.title} maxLines={1} truncate="END" style={{ fontSize: 12, color: palette.text }} />
          </FlexWidget>
        ))}
      </FlexWidget>
    );
  };
  return (
    <FlexWidget style={{ ...frame(palette), padding: 8 }} {...uri(matrixLink())}>
      <FlexWidget style={{ flex: 1, flexDirection: "row", width: "match_parent" }}>
        {cell(cases[0])}
        {cell(cases[1])}
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: "row", width: "match_parent" }}>
        {cell(cases[2])}
        {cell(cases[3])}
      </FlexWidget>
    </FlexWidget>
  );
}
