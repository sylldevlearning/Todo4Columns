// Simulation en mémoire d'expo-notifications pour les tests
const state = {
  scheduled: [], // { identifier, content, trigger }
  permission: "granted",
  canAskAgain: true,
  nextId: 1,
  listeners: [],
  lastResponse: null,
  channels: {},
  categories: {},
  handler: null,
};

const permissionResponse = () => ({
  status: state.permission,
  granted: state.permission === "granted",
  canAskAgain: state.canAskAgain,
  expires: "never",
});

module.exports = {
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  SchedulableTriggerInputTypes: { DATE: "date", TIME_INTERVAL: "timeInterval" },
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },

  scheduleNotificationAsync: jest.fn(async ({ content, trigger }) => {
    const identifier = `notif-${state.nextId++}`;
    state.scheduled.push({ identifier, content, trigger });
    return identifier;
  }),
  cancelScheduledNotificationAsync: jest.fn(async (identifier) => {
    state.scheduled = state.scheduled.filter((n) => n.identifier !== identifier);
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    state.scheduled = [];
  }),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    state.scheduled.map((n) => ({ ...n }))
  ),
  getPermissionsAsync: jest.fn(async () => permissionResponse()),
  requestPermissionsAsync: jest.fn(async () => {
    if (state.permission === "undetermined") state.permission = state.requestResult ?? "granted";
    return permissionResponse();
  }),
  setNotificationChannelAsync: jest.fn(async (id, channel) => {
    state.channels[id] = channel;
    return channel;
  }),
  setNotificationCategoryAsync: jest.fn(async (id, actions) => {
    state.categories[id] = actions;
    return { identifier: id, actions };
  }),
  setNotificationHandler: jest.fn((handler) => {
    state.handler = handler;
  }),
  addNotificationResponseReceivedListener: jest.fn((listener) => {
    state.listeners.push(listener);
    return {
      remove: () => {
        state.listeners = state.listeners.filter((l) => l !== listener);
      },
    };
  }),
  getLastNotificationResponse: jest.fn(() => state.lastResponse),
  clearLastNotificationResponse: jest.fn(() => {
    state.lastResponse = null;
  }),

  // Outils de test
  __state: state,
  __reset() {
    state.scheduled = [];
    state.permission = "granted";
    state.canAskAgain = true;
    state.requestResult = undefined;
    state.nextId = 1;
    state.listeners = [];
    state.lastResponse = null;
    state.channels = {};
    state.categories = {};
    state.handler = null;
  },
  __emitResponse(response) {
    state.listeners.forEach((l) => l(response));
  },
};
