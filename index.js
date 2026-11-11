// Point d'entrée : expo-router, plus le gestionnaire des widgets Android (tâche sans écran qui
// dessine les widgets et traite une coche faite depuis l'un d'eux, même app fermée)
import "expo-router/entry";
import { Platform } from "react-native";

if (Platform.OS === "android") {
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  const { widgetTaskHandler } = require("./src/widgets/taskHandler");
  registerWidgetTaskHandler(widgetTaskHandler);
}
