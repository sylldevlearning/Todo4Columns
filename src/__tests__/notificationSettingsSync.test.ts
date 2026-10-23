import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useTasks } from "../hooks/useTasks";
import { serializeTasks } from "../migrations";
import { Notifier } from "../notifications/service";
import { DEFAULT_SETTINGS, Settings } from "../settings";
import { STORAGE_KEY } from "../storage";
import { makeTask } from "../testing/makeTask";

const fakeNotifier = () => ({
  syncTask: jest.fn(async () => []),
  cancel: jest.fn(async () => {}),
  reconcile: jest.fn(async () => ({})),
});

const setup = async () => {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    serializeTasks([
      makeTask({ id: "a", title: "Appeler", category: "UI" }),
      makeTask({ id: "b", title: "Lire", category: "INU" }),
    ])
  );
  const notifier = fakeNotifier();
  const hook = await renderHook(
    ({ settings }: { settings: Settings }) => useTasks(settings, notifier as Notifier),
    { initialProps: { settings: DEFAULT_SETTINGS } }
  );
  // Réconciliation complète unique au démarrage
  await waitFor(() => expect(notifier.reconcile).toHaveBeenCalledTimes(1));
  return { ...hook, notifier };
};

describe("synchronisation des notifications", () => {
  beforeEach(() => AsyncStorage.clear());

  it("réglages relus à l'identique au démarrage : pas de seconde réconciliation", async () => {
    const { rerender, notifier } = await setup();
    await rerender({ settings: { ...DEFAULT_SETTINGS } });
    await act(async () => {});
    expect(notifier.reconcile).toHaveBeenCalledTimes(1);
  });

  it("animations ou archivage modifiés : rien n'est reprogrammé", async () => {
    const { rerender, notifier } = await setup();
    await rerender({ settings: { ...DEFAULT_SETTINGS, celebrations: false } });
    await rerender({ settings: { ...DEFAULT_SETTINGS, celebrations: false, autoArchive: true } });
    await act(async () => {});
    expect(notifier.reconcile).toHaveBeenCalledTimes(1);
  });

  it("réglage d'un rappel modifié : tout est reprogrammé une fois", async () => {
    const { rerender, notifier } = await setup();
    await rerender({ settings: { ...DEFAULT_SETTINGS, doNagInterval: 30 } });
    await waitFor(() => expect(notifier.reconcile).toHaveBeenCalledTimes(2));
  });

  it("une tâche modifiée : seule cette tâche est resynchronisée", async () => {
    const { result, notifier } = await setup();
    await act(() => result.current.toggleDone("a"));

    await waitFor(() => expect(notifier.syncTask).toHaveBeenCalledTimes(1));
    expect(notifier.syncTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", isDone: true }),
      DEFAULT_SETTINGS
    );
    expect(notifier.reconcile).toHaveBeenCalledTimes(1);
  });
});
