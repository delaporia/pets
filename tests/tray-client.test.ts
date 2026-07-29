import { describe, expect, it, vi } from "vitest";

import { TrayClient, type TrayState } from "../src/app/native/tray-client";

const state: TrayState = {
  pets: [
    { id: "wuyi", displayName: "Wuyi" },
    { id: "placeholder", displayName: "Placeholder" },
  ],
  selectedPetId: "wuyi",
  personalityMode: "balanced",
  testModeEnabled: false,
  paused: false,
  sleeping: false,
  visible: true,
  autostart: true,
  petScale: 1,
};

describe("TrayClient", () => {
  it("sends the complete tray state to Rust", async () => {
    const invoke = vi.fn(async () => undefined);
    const client = new TrayClient({ invoke });

    await client.configure(state);

    expect(invoke).toHaveBeenCalledWith("configure_tray", { state });
  });

  it("routes native tray events to typed handlers", async () => {
    const listeners = new Map<string, (event: { payload: unknown }) => void>();
    const listen = vi.fn(async (name: string, handler: typeof listeners extends Map<string, infer T> ? T : never) => {
      listeners.set(name, handler);
      return () => listeners.delete(name);
    });
    const selectPet = vi.fn();
    const pause = vi.fn();
    const selectPersonality = vi.fn();
    const selectScale = vi.fn();
    const petAction = vi.fn();
    const client = new TrayClient({
      invoke: vi.fn(async () => undefined),
      listen,
    });

    const dispose = await client.bind({
      selectPet,
      selectPersonality,
      selectScale,
      petAction,
      pause,
      visibility: vi.fn(),
      autostart: vi.fn(),
    });
    listeners.get("tray://select-pet")?.({ payload: "placeholder" });
    listeners.get("tray://pause")?.({ payload: null });
    listeners.get("tray://select-personality")?.({ payload: "lively" });
    listeners.get("tray://select-scale")?.({ payload: 1.25 });
    listeners.get("tray://pet-action")?.({ payload: "sleep" });

    expect(selectPet).toHaveBeenCalledWith("placeholder");
    expect(pause).toHaveBeenCalledOnce();
    expect(selectPersonality).toHaveBeenCalledWith("lively");
    expect(selectScale).toHaveBeenCalledWith(1.25);
    expect(petAction).toHaveBeenCalledWith("sleep");
    dispose();
    expect(listeners.size).toBe(0);
  });

  it("enables and disables autostart through the official plugin", async () => {
    const enable = vi.fn(async () => undefined);
    const disable = vi.fn(async () => undefined);
    const client = new TrayClient({
      invoke: vi.fn(async () => undefined),
      enableAutostart: enable,
      disableAutostart: disable,
    });

    await client.setAutostart(true);
    await client.setAutostart(false);

    expect(enable).toHaveBeenCalledOnce();
    expect(disable).toHaveBeenCalledOnce();
  });
});
