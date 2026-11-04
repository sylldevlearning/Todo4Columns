import { act, renderHook } from "@testing-library/react-native";
import { AppState, AppStateStatus } from "react-native";
import { useRemaining } from "../components/Countdown";
import { useNow } from "../hooks/useNow";

// Capture l'écouteur AppState pour simuler le passage en arrière-plan
let emitAppState: (state: AppStateStatus) => void = () => {};
const remove = jest.fn();
// Intervalles en cours (les autres minuteries de React ne comptent pas)
const intervals = new Set<unknown>();
const runningIntervals = () => intervals.size;

describe("rafraîchissements de l'heure", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-03-02T10:00:00") });
    Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      emitAppState = handler as (state: AppStateStatus) => void;
      return { remove } as ReturnType<typeof AppState.addEventListener>;
    });
    remove.mockClear();
    intervals.clear();
    const setInterval = globalThis.setInterval;
    const clearInterval = globalThis.clearInterval;
    jest.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void, ms: number) => {
      const id = setInterval(fn, ms);
      intervals.add(id);
      return id;
    }) as typeof globalThis.setInterval);
    jest.spyOn(globalThis, "clearInterval").mockImplementation((id) => {
      intervals.delete(id);
      clearInterval(id);
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("useNow se rafraîchit à intervalle régulier quand l'app est à l'écran", async () => {
    const { result } = await renderHook(() => useNow(30_000));
    const start = result.current;

    await act(() => jest.advanceTimersByTime(30_000));
    expect(result.current).toBe(start + 30_000);
  });

  it("aucun rafraîchissement en arrière-plan, relecture immédiate au retour", async () => {
    const { result } = await renderHook(() => useNow(30_000));
    const start = result.current;

    await act(() => emitAppState("background"));
    expect(runningIntervals()).toBe(0);
    await act(() => jest.advanceTimersByTime(5 * 60_000));
    expect(result.current).toBe(start);

    await act(() => emitAppState("active"));
    expect(result.current).toBe(start + 5 * 60_000);
    expect(runningIntervals()).toBe(1);
  });

  it("ne démarre pas si l'app est lancée en arrière-plan", async () => {
    Object.defineProperty(AppState, "currentState", { value: "background", configurable: true });
    await renderHook(() => useNow(1000));
    expect(runningIntervals()).toBe(0);
  });

  it("le minuteur se calcule depuis l'horodatage de fin et s'arrête à zéro", async () => {
    const end = Date.now() + 3000;
    const { result } = await renderHook(() => useRemaining(end));
    expect(result.current).toBe("00:03");

    // Un tic retardé ne décale pas le décompte : il se base sur l'heure réelle
    jest.setSystemTime(Date.now() + 2000);
    await act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe("00:00");
    expect(runningIntervals()).toBe(0);
  });

  it("libère l'intervalle et l'écouteur au démontage", async () => {
    const { unmount } = await renderHook(() => useNow(1000));
    await unmount();
    expect(runningIntervals()).toBe(0);
    expect(remove).toHaveBeenCalled();
  });
});
