// Option « 1 min » : visible en développement, absente d'un build de production
type Reminders = typeof import("../reminders");

const loadReminders = (dev: boolean): Reminders => {
  const g = globalThis as unknown as { __DEV__: boolean };
  const previous = g.__DEV__;
  g.__DEV__ = dev;
  let mod!: Reminders;
  jest.isolateModules(() => {
    mod = require("../reminders");
  });
  g.__DEV__ = previous;
  return mod;
};

describe("option de délai « 1 min »", () => {
  it("est proposée en premier en mode développement", () => {
    const r = loadReminders(true);
    expect(r.DO_NAG_OPTIONS[0]).toEqual({ label: "1 min", value: 1 });
    expect(r.PLAN_REMINDER_OPTIONS[0]).toEqual({ label: "1 min avant", value: 1 });
    expect(r.DELEGATE_FOLLOW_UP_OPTIONS[0]).toEqual({ label: "1 min", value: 1 });
  });

  it("n'existe pas en production", () => {
    const r = loadReminders(false);
    for (const options of [r.DO_NAG_OPTIONS, r.PLAN_REMINDER_OPTIONS, r.DELEGATE_FOLLOW_UP_OPTIONS]) {
      expect(options.some((o) => o.value === 1)).toBe(false);
    }
    expect(r.DO_NAG_OPTIONS.map((o) => o.label)).toEqual(["30 min", "2 h", "1 jour", "Jamais"]);
  });
});
