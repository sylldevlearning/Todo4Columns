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

// Connexion Google (sauvegarde Drive) : aucun module natif dans Jest. Les tests de la sauvegarde
// Drive remplacent ce mock par le leur (src/drive/googleAccount).
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ type: "cancelled", data: null })),
    signInSilently: jest.fn(async () => ({ type: "noSavedCredentialFound", data: null })),
    signOut: jest.fn(async () => null),
    getCurrentUser: jest.fn(() => null),
    getTokens: jest.fn(async () => {
      throw new Error("Non connecté");
    }),
    clearCachedAccessToken: jest.fn(async () => null),
  },
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED", IN_PROGRESS: "IN_PROGRESS", SIGN_IN_REQUIRED: "SIGN_IN_REQUIRED" },
  isCancelledResponse: (r) => r?.type === "cancelled",
  isNoSavedCredentialFoundResponse: (r) => r?.type === "noSavedCredentialFound",
  isErrorWithCode: (e) => typeof e?.code === "string",
}));

// Reconnaissance vocale (dictée) : module natif simulé. Les écouteurs d'événements sont gardés pour
// que les tests puissent simuler une transcription (__emit).
jest.mock("expo-speech-recognition", () => {
  const React = require("react");
  const listeners = new Map();
  const module = {
    getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" })),
    isRecognitionAvailable: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  };
  const emit = (name, event) => (listeners.get(name) ?? new Set()).forEach((l) => l(event));
  return {
    ExpoSpeechRecognitionModule: module,
    useSpeechRecognitionEvent: (name, listener) => {
      const ref = React.useRef(listener);
      ref.current = listener;
      React.useEffect(() => {
        const l = (e) => ref.current(e);
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(l);
        return () => listeners.get(name).delete(l);
      }, [name]);
    },
    __emit: emit,
    __listeners: listeners,
  };
});
