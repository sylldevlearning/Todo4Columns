// Noms et descriptions des widgets dans le sélecteur de widgets du téléphone, dans les 13 langues
// de l'app (src/widgets/pickerStrings.json), dans des fichiers à part (widget_strings.xml) :
// libellés @string/widget_<nom>_label et descriptions @string/widget_<nom>_desc. Le plugin
// react-native-android-widget écrit sa propre description, marquée non traduisible : app.json lui
// donne pour valeur l'alias « @string/widget_<nom>_desc », pour ne jamais traduire une chaîne
// marquée non traduisible (erreur de vérification Android).
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");
const strings = require("../src/widgets/pickerStrings.json");

// Dossiers de ressources Android des langues de l'app
const FOLDERS = {
  en: "values",
  fr: "values-fr",
  es: "values-es",
  "pt-BR": "values-pt-rBR",
  de: "values-de",
  it: "values-it",
  id: "values-in",
  ja: "values-ja",
  ko: "values-ko",
  "zh-Hans": "values-b+zh+Hans",
  tr: "values-tr",
  hi: "values-hi",
  ru: "values-ru",
};
// Clé du widget → nom donné dans app.json (en minuscules dans les ressources)
const WIDGETS = { do: "dofirstdo", today: "dofirsttoday", matrix: "dofirstmatrix" };

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'").replace(/"/g, '\\"');

function widgetStringsXml(language) {
  const entries = Object.entries(WIDGETS).flatMap(([key, name]) => {
    const { label, description } = strings[language][key];
    return [
      `    <string name="widget_${name}_label">${escape(label)}</string>`,
      `    <string name="widget_${name}_desc">${escape(description)}</string>`,
    ];
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${entries.join("\n")}\n</resources>\n`;
}

module.exports = function withWidgetStrings(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res");
      for (const [language, folder] of Object.entries(FOLDERS)) {
        fs.mkdirSync(path.join(res, folder), { recursive: true });
        fs.writeFileSync(path.join(res, folder, "widget_strings.xml"), widgetStringsXml(language));
      }
      return cfg;
    },
  ]);
};
module.exports.FOLDERS = FOLDERS;
module.exports.widgetStringsXml = widgetStringsXml;
