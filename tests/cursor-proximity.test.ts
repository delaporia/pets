import { describe, expect, it, vi } from "vitest";

import { CooldownLedger } from "../src/app/behaviors/cooldown-ledger";
import { CursorProximityController } from "../src/app/interactions/cursor-proximity";
import type { BehaviorProfile } from "../src/app/pets/schemas";

const profile: BehaviorProfile = {
  scheduler: {
    minIntervalMs: 6_000,
    maxIntervalMs: 12_000,
    recoveryMs: 6_000,
  },
  movement: {
    walkSpeed: 42,
    minDurationMs: 3_000,
    maxDurationMs: 6_000,
    roamingHalfWidth: 200,
  },
  categoryWeights: {
    movement: 10,
    ambient: 20,
    rest: 30,
    social: 40,
  },
  actions: [
    {
      id: "approach",
      capability: "approach",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 25_000,
    },
  ],
  interaction: {
    nearbyRadius: 240,
    cursorPollMs: 250,
    multiClickWindowMs: 1_800,
    multiClickThreshold: 3,
    nearbyAction: "approach",
    pickedUpCapability: "pickedUp",
    landCapability: "land",
  },
  fallbackCapabilities: ["idle"],
};

function state(nowMs: number) {
  return {
    nowMs,
    position: { x: 100, y: 100 },
    windowSize: { width: 100, height: 120 },
    dragging: false,
    activeBehaviorId: "idle",
    personalityMode: "balanced" as const,
  };
}

describe("CursorProximityController", () => {
  it("requests the configured action when the cursor is nearby", async () => {
    const native = {
      cursorPosition: vi.fn(async () => ({ x: 230, y: 160 })),
    };
    const machine = { request: vi.fn(() => true) };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      machine,
      native,
    );

    expect(await controller.update(state(0))).toBe(true);
    expect(machine.request).toHaveBeenCalledWith("action-approach", {
      restart: true,
      source: "user",
    });
  });

  it("does not poll more often than the pet interval", async () => {
    const native = {
      cursorPosition: vi.fn(async () => ({ x: 230, y: 160 })),
    };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      { request: vi.fn(() => true) },
      native,
    );

    await controller.update(state(0));
    await controller.update(state(249));
    await controller.update(state(250));

    expect(native.cursorPosition).toHaveBeenCalledTimes(2);
  });

  it("ignores distant cursors and active drag or landing", async () => {
    const native = {
      cursorPosition: vi.fn(async () => ({ x: 1_000, y: 1_000 })),
    };
    const machine = { request: vi.fn(() => true) };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      machine,
      native,
    );

    expect(await controller.update(state(0))).toBe(false);
    expect(
      await controller.update({ ...state(250), dragging: true }),
    ).toBe(false);
    expect(
      await controller.update({
        ...state(500),
        activeBehaviorId: "landing",
      }),
    ).toBe(false);
    expect(machine.request).not.toHaveBeenCalled();
  });

  it("disables cursor interest in quiet mode", async () => {
    const native = {
      cursorPosition: vi.fn(async () => ({ x: 230, y: 160 })),
    };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      { request: vi.fn(() => true) },
      native,
    );

    expect(
      await controller.update({
        ...state(0),
        personalityMode: "quiet",
      }),
    ).toBe(false);
    expect(native.cursorPosition).not.toHaveBeenCalled();
  });

  it("does not run cursor-follow behavior while the interaction wheel is open", async () => {
    const native = {
      cursorPosition: vi.fn(async () => ({ x: 230, y: 160 })),
    };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      { request: vi.fn(() => true) },
      native,
    );

    expect(
      await controller.update({
        ...state(0),
        interactionActive: true,
      }),
    ).toBe(false);
    expect(native.cursorPosition).not.toHaveBeenCalled();
  });

  it("degrades safely when native cursor lookup fails", async () => {
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      { request: vi.fn(() => true) },
      {
        cursorPosition: vi.fn(async () => {
          throw new Error("unavailable");
        }),
      },
    );

    await expect(controller.update(state(0))).resolves.toBe(false);
  });

  it("suppresses gaze while another action is active", async () => {
    const cooldowns = new CooldownLedger();
    cooldowns.mark("approach", 0, 25_000);
    const gaze = {
      look: vi.fn(),
      clear: vi.fn(),
    };
    const controller = new CursorProximityController(
      profile,
      cooldowns,
      { request: vi.fn(() => true) },
      {
        cursorPosition: vi.fn(async () => ({ x: 230, y: 160 })),
      },
      gaze,
    );

    expect(
      await controller.update({
        ...state(1_000),
        activeBehaviorId: "action-self-groom",
      }),
    ).toBe(false);
    expect(gaze.look).not.toHaveBeenCalled();
    expect(gaze.clear).toHaveBeenCalled();
  });

  it("ignores the cursor over the pet body and its safety margin", async () => {
    const gaze = { look: vi.fn(), clear: vi.fn() };
    const machine = { request: vi.fn(() => true) };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      machine,
      {
        cursorPosition: vi.fn(async () => ({ x: 160, y: 170 })),
      },
      gaze,
    );

    expect(await controller.update(state(0))).toBe(false);
    expect(gaze.look).not.toHaveBeenCalled();
    expect(machine.request).not.toHaveBeenCalled();
  });

  it("greets once on entry and then only after the balanced repeat interval", async () => {
    const machine = { request: vi.fn(() => true) };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      machine,
      {
        cursorPosition: vi.fn(async () => ({ x: 230, y: 160 })),
      },
    );

    expect(await controller.update(state(0))).toBe(true);
    expect(await controller.update(state(250))).toBe(false);
    expect(await controller.update(state(29_999))).toBe(false);
    expect(await controller.update(state(30_249))).toBe(true);
    expect(machine.request).toHaveBeenCalledTimes(2);
  });

  it("clears gaze on departure and immediately responds on re-entry", async () => {
    const positions = [
      { x: 230, y: 160 },
      { x: 1_000, y: 1_000 },
      { x: 230, y: 160 },
    ];
    const gaze = { look: vi.fn(), clear: vi.fn() };
    const machine = { request: vi.fn(() => true) };
    const controller = new CursorProximityController(
      profile,
      new CooldownLedger(),
      machine,
      {
        cursorPosition: vi.fn(async () => positions.shift()!),
      },
      gaze,
    );

    expect(await controller.update(state(0))).toBe(true);
    expect(await controller.update(state(250))).toBe(false);
    expect(gaze.clear).toHaveBeenCalled();
    expect(await controller.update(state(500))).toBe(true);
    expect(machine.request).toHaveBeenCalledTimes(2);
  });
});
