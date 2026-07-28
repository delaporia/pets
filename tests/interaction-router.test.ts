import { describe, expect, it, vi } from "vitest";

import { CooldownLedger } from "../src/app/behaviors/cooldown-ledger";
import { InteractionRouter } from "../src/app/interactions/interaction-router";
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
      id: "soft-paw",
      capability: "softPaw",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 5_000,
    },
    {
      id: "nuzzle",
      capability: "nuzzle",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 10_000,
    },
  ],
  interaction: {
    nearbyRadius: 240,
    cursorPollMs: 250,
    multiClickWindowMs: 1_800,
    multiClickThreshold: 3,
    singleClickAction: "soft-paw",
    multiClickAction: "nuzzle",
    nearbyAction: "nuzzle",
    pickedUpCapability: "pickedUp",
    landCapability: "land",
  },
  fallbackCapabilities: ["idle"],
};

function fixture() {
  const machine = { request: vi.fn(() => true) };
  const cooldowns = new CooldownLedger();
  const router = new InteractionRouter(profile, cooldowns, machine);
  return { machine, cooldowns, router };
}

describe("InteractionRouter", () => {
  it("routes a single click to the pet's configured action", () => {
    const { machine, router } = fixture();

    expect(router.onClick(1_000)).toBe(true);
    expect(machine.request).toHaveBeenCalledWith("action-soft-paw", {
      restart: true,
      source: "user",
    });
  });

  it("routes the threshold click to the multi-click action", () => {
    const { machine, router } = fixture();

    router.onClick(1_000);
    router.onClick(1_500);
    router.onClick(2_000);

    expect(machine.request).toHaveBeenLastCalledWith("action-nuzzle", {
      restart: true,
      source: "user",
    });
  });

  it("resets the click count outside the configured window", () => {
    const { machine, router } = fixture();

    router.onClick(1_000);
    router.onClick(3_000);

    expect(machine.request).toHaveBeenLastCalledWith("action-soft-paw", {
      restart: true,
      source: "user",
    });
  });

  it("does not let an autonomous cooldown suppress a direct click", () => {
    const { machine, cooldowns, router } = fixture();
    cooldowns.mark("soft-paw", 1_000, 5_000);

    expect(router.onClick(2_000)).toBe(true);
    expect(machine.request).toHaveBeenCalledWith("action-soft-paw", {
      restart: true,
      source: "user",
    });
  });

  it("filters only accidental duplicate click delivery within 150 ms", () => {
    const { machine, router } = fixture();

    expect(router.onClick(1_000)).toBe(true);
    expect(router.onClick(1_100)).toBe(false);
    expect(router.onClick(1_150)).toBe(true);
    expect(machine.request).toHaveBeenCalledTimes(2);
  });

  it("cancels click accumulation when dragging starts", () => {
    const { machine, router } = fixture();
    router.onClick(1_000);
    router.onClick(1_500);

    router.onDragStart();
    router.onDragEnd();
    router.onClick(2_000);

    expect(machine.request).toHaveBeenCalledWith("drag-and-drop", {
      restart: true,
      source: "user",
    });
    expect(machine.request).toHaveBeenCalledWith("landing", {
      restart: true,
      source: "user",
    });
    expect(machine.request).toHaveBeenLastCalledWith("action-soft-paw", {
      restart: true,
      source: "user",
    });
  });
});
