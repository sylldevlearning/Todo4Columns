// AsyncStorage en mémoire pour les tests
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// expo-notifications simulé (notifications programmées en mémoire)
jest.mock("expo-notifications", () => require("./jest/expo-notifications-mock"));

beforeEach(() => {
  require("expo-notifications").__reset();
});
