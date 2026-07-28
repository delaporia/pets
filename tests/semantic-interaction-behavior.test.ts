import { describe, expect, it, vi } from "vitest";

import { SemanticInteractionBehavior } from "../src/app/behaviors/semantic-interaction";
import { defaultBehaviorProfile } from "../src/app/pets/schemas";
import { defaultPetCareState } from "../src/app/care/care-state";
import { CooldownLedger } from "../src/app/behaviors/cooldown-ledger";
import type { PetContext } from "../src/app/runtime/pet-context";

function context(): PetContext {
  return {
    position: { x: 0, y: 0 },
    workArea: { x: 0, y: 0, width: 500, height: 400 },
    windowSize: { width: 100, height: 120 },
    velocity: { x: 0, y: 0 },
    activityAnchor: null,
    roamingHalfWidth: 180,
    behaviorProfile: defaultBehaviorProfile,
    careState: defaultPetCareState(0),
    elapsedMs: 0,
    cooldowns: new CooldownLedger(),
    personalityMode: "balanced",
    paused: false,
    drag: {
      active: false,
      pointer: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
    },
    animations: {
      play: vi.fn(),
      hasCapability: () => true,
      durationMs: vi.fn(() => 500),
    },
    random: () => 0,
  };
}

describe("SemanticInteractionBehavior", () => {
  it("plays a timed feeding interaction to completion", () => {
    const pet = context();
    const behavior = new SemanticInteractionBehavior(
      "feed",
      {
        enter: "feed-enter",
        loop: "feed-loop",
        exit: "feed-exit",
        loopDuration: { minMs: 2_000, maxMs: 2_000 },
      },
      "timed",
    );

    behavior.enter(pet);
    expect(pet.animations.play).toHaveBeenLastCalledWith(
      "feed-enter",
      true,
    );
    expect(behavior.update(pet, 500)).toEqual({ status: "running" });
    expect(behavior.update(pet, 2_000)).toEqual({ status: "running" });
    expect(behavior.update(pet, 500)).toEqual({
      status: "complete",
      next: "idle",
    });
  });

  it("keeps sleeping until wake is requested and then plays exit", () => {
    const pet = context();
    const behavior = new SemanticInteractionBehavior(
      "sleep",
      {
        enter: "sleep-enter",
        loop: "sleep-loop",
        exit: "wake",
      },
      "until-stopped",
    );

    behavior.enter(pet);
    behavior.update(pet, 500);
    expect(behavior.update(pet, 60_000)).toEqual({ status: "running" });

    behavior.requestExit();
    expect(behavior.update(pet, 0)).toEqual({ status: "running" });
    expect(pet.animations.play).toHaveBeenLastCalledWith("wake", true);
    expect(behavior.update(pet, 500)).toEqual({
      status: "complete",
      next: "idle",
    });
  });
});
