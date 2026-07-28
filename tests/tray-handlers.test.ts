import { describe, expect, it, vi } from "vitest";

import { createTrayHandlers } from "../src/app/bootstrap/tray-handlers";
import { defaultUserSettings } from "../src/app/config/settings";

function fixture() {
  let settings = defaultUserSettings();
  const dependencies = {
    getSettings: () => settings,
    saveSettings: vi.fn(async (next: typeof settings) => {
      settings = next;
    }),
    switchPet: vi.fn(async (_id: string): Promise<void> => undefined),
    setPaused: vi.fn(),
    setVisible: vi.fn(async () => undefined),
    setAutostart: vi.fn(async () => undefined),
    setPersonality: vi.fn(),
    setScale: vi.fn(async () => undefined),
    refreshTray: vi.fn(async () => undefined),
  };
  return { dependencies, getSettings: () => settings };
}

describe("tray runtime handlers", () => {
  it("preloads and switches a pet before saving its id", async () => {
    const f = fixture();
    const handlers = createTrayHandlers(f.dependencies);

    await handlers.selectPet("wuyi");

    expect(f.dependencies.switchPet).toHaveBeenCalledWith("wuyi");
    expect(f.getSettings().selectedPetId).toBe("wuyi");
    expect(f.dependencies.refreshTray).toHaveBeenCalledOnce();
  });

  it("serializes rapid pet selections and leaves only the last pet selected", async () => {
    const f = fixture();
    let releaseFirstSwitch: (() => void) | undefined;
    f.dependencies.switchPet.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          if (!releaseFirstSwitch) {
            releaseFirstSwitch = resolve;
          } else {
            resolve();
          }
        }),
    );
    const handlers = createTrayHandlers(f.dependencies);

    const first = handlers.selectPet("wuyi");
    const second = handlers.selectPet("ying");
    await Promise.resolve();

    expect(f.dependencies.switchPet).toHaveBeenCalledTimes(1);
    releaseFirstSwitch?.();
    await Promise.all([first, second]);

    expect(f.dependencies.switchPet.mock.calls).toEqual([["wuyi"], ["ying"]]);
    expect(f.getSettings().selectedPetId).toBe("ying");
  });

  it("toggles pause and visibility", async () => {
    const f = fixture();
    const handlers = createTrayHandlers(f.dependencies);

    await handlers.pause();
    await handlers.visibility();

    expect(f.dependencies.setPaused).toHaveBeenCalledWith(true);
    expect(f.dependencies.setVisible).toHaveBeenCalledWith(false);
    expect(f.getSettings()).toMatchObject({
      activityPaused: true,
      visible: false,
    });
  });

  it("changes autostart before persisting the setting", async () => {
    const f = fixture();
    const handlers = createTrayHandlers(f.dependencies);

    await handlers.autostart();

    expect(f.dependencies.setAutostart).toHaveBeenCalledWith(false);
    expect(f.getSettings().autostart).toBe(false);
    expect(f.dependencies.saveSettings).toHaveBeenCalledOnce();
  });

  it("applies and persists the selected personality", async () => {
    const f = fixture();
    const handlers = createTrayHandlers(f.dependencies);

    await handlers.selectPersonality("lively");

    expect(f.dependencies.setPersonality).toHaveBeenCalledWith("lively");
    expect(f.getSettings().personalityMode).toBe("lively");
    expect(f.dependencies.refreshTray).toHaveBeenCalledOnce();
  });

  it("recreates the pet at the selected scale and persists it", async () => {
    const f = fixture();
    const handlers = createTrayHandlers(f.dependencies);

    await handlers.selectScale(1.25);

    expect(f.dependencies.setScale).toHaveBeenCalledWith(1.25);
    expect(f.getSettings().petScale).toBe(1.25);
  });
});
