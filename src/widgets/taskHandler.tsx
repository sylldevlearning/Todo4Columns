import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { checkFromWidget } from "./complete";
import { COMPLETE_ACTION } from "./links";
import { readStoredSource, refreshWidgets, renderWidget, WIDGET_NAMES } from "./render";

// Gestionnaire Android des widgets (tâche JavaScript sans écran) : ajout, redimensionnement,
// rafraîchissement périodique, et coche d'une tâche depuis un widget.
export async function widgetTaskHandler({
  widgetInfo,
  widgetAction,
  clickAction,
  clickActionData,
  renderWidget: draw,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === "WIDGET_DELETED") return;

  if (widgetAction === "WIDGET_CLICK") {
    if (clickAction !== COMPLETE_ACTION) return; // liens : ouverts par Android
    const taskId = typeof clickActionData?.taskId === "string" ? clickActionData.taskId : null;
    const stepId = typeof clickActionData?.stepId === "string" ? clickActionData.stepId : null;
    if (taskId === null) return;
    const result = await checkFromWidget({ taskId, stepId });
    // App ouverte : ses widgets sont redessinés après la mise à jour de ses tâches (WidgetSync)
    if (result === "live") return;
    const source = await readStoredSource();
    draw(renderWidget(widgetInfo.widgetName, widgetInfo, source));
    await refreshWidgets(source, WIDGET_NAMES.filter((n) => n !== widgetInfo.widgetName));
    return;
  }

  // Ajout, redimensionnement, rafraîchissement : données enregistrées (ou celles de l'app ouverte,
  // enregistrées au plus tard une demi-seconde après chaque changement)
  draw(renderWidget(widgetInfo.widgetName, widgetInfo, await readStoredSource()));
}
