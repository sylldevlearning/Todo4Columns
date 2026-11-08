// Configuration Jest.
//
// expo-asset et expo-keep-awake sont des dépendances d'expo : selon l'arbre construit par npm,
// ils sont installés dans node_modules/expo/node_modules ou à la racine de node_modules.
// Ils sont donc résolus depuis le paquet expo, au lieu d'un chemin écrit en dur.
const path = require("path");

const expoDir = path.dirname(require.resolve("expo/package.json"));
const fromExpo = (name) => path.dirname(require.resolve(`${name}/package.json`, { paths: [expoDir] }));
const expoAsset = fromExpo("expo-asset");
const expoKeepAwake = fromExpo("expo-keep-awake");

module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^expo-asset$": expoAsset,
    "^expo-asset/(.*)$": `${expoAsset}/$1`,
    "^expo-keep-awake$": expoKeepAwake,
    "^expo-keep-awake/(.*)$": `${expoKeepAwake}/$1`,
  },
  globalSetup: "./jest/global-setup.js",
  setupFilesAfterEnv: ["./jest.setup.js"],
};
