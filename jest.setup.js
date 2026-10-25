// AsyncStorage en mémoire pour les tests
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// expo-notifications simulé (notifications programmées en mémoire)
jest.mock("expo-notifications", () => require("./jest/expo-notifications-mock"));

beforeEach(() => {
  require("expo-notifications").__reset();
});

// Téléphone en français par défaut (les tests i18n changent la langue au cas par cas)
jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "fr", languageTag: "fr-FR" }]),
}));

// Fenêtre d'avis du Play Store simulée
jest.mock("expo-store-review", () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
  hasAction: jest.fn(async () => true),
  storeUrl: jest.fn(() => null),
}));

// Reanimated et Worklets : mocks officiels (pas de thread UI dans Jest)
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
