import { describe, expect, it, vi } from "vitest";

import { DragAndDropBehavior } from "../src/app/behaviors/drag-and-drop";
import { FallToGroundBehavior } from "../src/app/behaviors/fall-to-ground";
import { GroundWalkBehavior } from "../src/app/behaviors/ground-walk";
import { IdleBehavior } from "../src/app/behaviors/idle";
import { ScheduledAnimationBehavior } from "../src/app/behaviors/scheduled-animation";
import { LandingBehavior } from "../src/app/behaviors/landing";
import { CooldownLedger } from "../src/app/behaviors/cooldown-ledger";
import type { BehaviorProfile } from "../src/app/pets/schemas";
import type { PetContext } from "../src/app/runtime/pet-context";
import { defaultPetCareState } from "../src/app/care/care-state";

const behaviorProfile: BehaviorProfile = {
  scheduler: {
    minIntervalMs: 6_000,
    maxIntervalMs: 12_000,
    recoveryMs: 6_000,
  },
  movement: {
    walkSpeed: 42,
    minDurationMs: 3_000,
    maxDurationMs: 6_000,
    roamingHalfWidth: 160,
  },
  categoryWeights: {
    movement: 10,
    ambient: 20,
    rest: 40,
    social: 30,
  },
  actions: [
    {
      id: "wave",
      capability: "wave",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 25_000,
    },
    {
      id: "waiting",
      capability: "waiting",
      category: "rest",
      playback: "timed",
      weight: 1,
      cooldownMs: 10_000,
      minDurationMs: 5_000,
      maxDurationMs: 9_000,
    },
  ],
  interaction: {
    nearbyRadius: 240,
    cursorPollMs: 250,
    multiClickWindowMs: 1_800,
    multiClickThreshold: 3,
    singleClickAction: "wave",
    multiClickAction: "waiting",
    pickedUpCapability: "idle",
    landCapability: "idle",
  },
  fallbackCapabilities: ["idle"],
};

function context(random = () => 0): PetContext {
  return {
    position: { x: 20, y: 10 },
    workArea: { x: 0, y: 0, width: 500, height: 400 },
    windowSize: { width: 100, height: 120 },
    velocity: { x: 0, y: 0 },
    activityAnchor: null,
    roamingHalfWidth: behaviorProfile.movement.roamingHalfWidth,
    behaviorProfile,
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
      durationMs: vi.fn(() => 750),
    },
    random,
  };
}

describe("IdleBehavior", () => {
  it("does not start autonomous actions while an interaction is open", () => {
    const pet = context(() => 0);
    pet.interactionActive = true;
    const idle = new IdleBehavior();
    idle.enter(pet);

    expect(idle.update(pet, 60_000)).toEqual({ status: "running" });
  });

  it("uses the pet's balanced six-to-twelve-second scheduler interval", () => {
    const minimum = context(() => 0);
    const maximum = context(() => 1);
    const minIdle = new IdleBehavior();
    const maxIdle = new IdleBehavior();
    minIdle.enter(minimum);
    maxIdle.enter(maximum);

    expect(minIdle.update(minimum, 5_999).status).toBe("running");
    expect(minIdle.update(minimum, 1)).toMatchObject({ status: "complete" });
    expect(maxIdle.update(maximum, 11_999).status).toBe("running");
    expect(maxIdle.update(maximum, 1)).toMatchObject({ status: "complete" });
  });

  it("scales but never replaces the pet scheduler interval", () => {
    const quiet = context(() => 0);
    quiet.personalityMode = "quiet";
    const lively = context(() => 0);
    lively.personalityMode = "lively";
    const quietIdle = new IdleBehavior();
    const livelyIdle = new IdleBehavior();

    quietIdle.enter(quiet);
    livelyIdle.enter(lively);

    expect(quietIdle.update(quiet, 8_399).status).toBe("running");
    expect(quietIdle.update(quiet, 1).status).toBe("complete");
    expect(livelyIdle.update(lively, 5_999).status).toBe("running");
    expect(livelyIdle.update(lively, 1).status).toBe("complete");
  });

  it("does not schedule the same autonomous action twice in succession", () => {
    const values = [0, 0, 0, 0, 0, 0];
    const pet = context(() => values.shift() ?? 0);
    pet.behaviorProfile = {
      ...behaviorProfile,
      categoryWeights: {
        movement: 10,
        ambient: 0,
        rest: 0,
        social: 10,
      },
      actions: [behaviorProfile.actions[0]!],
    };
    const idle = new IdleBehavior();

    idle.enter(pet);
    expect(idle.update(pet, 6_000)).toEqual({
      status: "complete",
      next: "walk-left",
    });
    idle.enter(pet);
    expect(idle.update(pet, 6_000)).toEqual({
      status: "complete",
      next: "walk-right",
    });
  });

  it("uses category and action weights", () => {
    const values = [0, 0.2, 0];
    const pet = context(() => values.shift() ?? 0);
    const idle = new IdleBehavior();

    idle.enter(pet);

    expect(idle.update(pet, 6_000)).toEqual({
      status: "complete",
      next: "action-wave",
    });
  });

  it("excludes actions that are cooling down", () => {
    const values = [0, 0.95, 0];
    const pet = context(() => values.shift() ?? 0);
    pet.cooldowns.mark("wave", 0, 25_000);
    const idle = new IdleBehavior();

    idle.enter(pet);

    expect(idle.update(pet, 6_000)).toEqual({
      status: "complete",
      next: "action-waiting",
    });
  });

  it("uses low energy to favor rest over an equally weighted alternative", () => {
    const values = [0, 0, 0.7];
    const pet = context(() => values.shift() ?? 0);
    pet.careState = {
      ...pet.careState,
      energy: 10,
    };
    pet.behaviorProfile = {
      ...behaviorProfile,
      categoryWeights: {
        movement: 0,
        ambient: 0,
        rest: 1,
        social: 0,
      },
      actions: [
        {
          id: "deep-rest",
          capability: "sleep",
          category: "rest",
          playback: "timed",
          weight: 1,
          cooldownMs: 0,
          minDurationMs: 1_000,
          maxDurationMs: 2_000,
        },
        {
          id: "quiet-rest",
          capability: "idle",
          category: "rest",
          playback: "timed",
          weight: 1,
          cooldownMs: 0,
          minDurationMs: 1_000,
          maxDurationMs: 2_000,
        },
      ],
    };
    const idle = new IdleBehavior();

    idle.enter(pet);

    expect(idle.update(pet, 6_000)).toEqual({
      status: "complete",
      next: "action-deep-rest",
    });
  });
});

describe("GroundWalkBehavior", () => {
  it("cannot start while an interaction is open", () => {
    const pet = context();
    pet.interactionActive = true;

    expect(new GroundWalkBehavior("right").canEnter(pet)).toBe(false);
  });

  it("moves right at the pet's configured speed", () => {
    const pet = context();
    const walk = new GroundWalkBehavior("right");
    walk.enter(pet);

    expect(walk.update(pet, 1_000)).toEqual({ status: "running" });
    expect(pet.position.x).toBe(62);
    expect(pet.animations.play).toHaveBeenCalledWith("walkRight");
  });

  it("changes walking speed with the active personality", () => {
    const quiet = context();
    quiet.personalityMode = "quiet";
    const lively = context();
    lively.personalityMode = "lively";
    const quietWalk = new GroundWalkBehavior("right");
    const livelyWalk = new GroundWalkBehavior("right");
    quietWalk.enter(quiet);
    livelyWalk.enter(lively);

    quietWalk.update(quiet, 1_000);
    livelyWalk.update(lively, 1_000);

    expect(quiet.position.x).toBeCloseTo(53.6);
    expect(lively.position.x).toBeCloseTo(70.4);
  });

  it("clamps at the edge and returns to the random scheduler", () => {
    const pet = context();
    pet.position.x = 390;
    const walk = new GroundWalkBehavior("right");
    walk.enter(pet);

    expect(walk.update(pet, 1_000)).toEqual({
      status: "complete",
      next: "idle",
    });
    expect(pet.position.x).toBe(400);
  });

  it("walks only within the pet's configured radius of the activity anchor", () => {
    const pet = context();
    pet.workArea.width = 1_000;
    pet.activityAnchor = { x: 400, y: 75 };
    pet.position = { x: 590, y: 75 };
    const walk = new GroundWalkBehavior("right");
    walk.enter(pet);

    expect(walk.update(pet, 1_000)).toEqual({
      status: "complete",
      next: "idle",
    });
    expect(pet.position).toEqual({ x: 560, y: 75 });
  });

  it("clips the anchor roaming range to the work area", () => {
    const pet = context();
    pet.activityAnchor = { x: 50, y: 80 };
    pet.position = { x: 5, y: 80 };
    const walk = new GroundWalkBehavior("left");
    walk.enter(pet);

    expect(walk.update(pet, 1_000)).toEqual({
      status: "complete",
      next: "idle",
    });
    expect(pet.position).toEqual({ x: 0, y: 80 });
  });

  it("stops after the pet's sampled walk duration", () => {
    const pet = context(() => 0);
    pet.workArea.width = 2_000;
    const walk = new GroundWalkBehavior("right");
    walk.enter(pet);

    expect(walk.update(pet, 2_999)).toEqual({ status: "running" });
    expect(walk.update(pet, 1)).toEqual({
      status: "complete",
      next: "idle",
    });
  });
});

describe("ScheduledAnimationBehavior", () => {
  it("runs a semantic action through enter, loop and exit clips", () => {
    const pet = context(() => 0);
    const action = new ScheduledAnimationBehavior(
      {
        id: "feeding",
        capability: "feed",
        category: "social",
        playback: "timed",
        weight: 1,
        cooldownMs: 10_000,
        minDurationMs: 2_000,
        maxDurationMs: 2_000,
      },
      {
        enter: "feed-enter",
        loop: "feed-loop",
        exit: "feed-exit",
        loopDuration: { minMs: 4_000, maxMs: 8_000 },
      },
    );

    action.enter(pet);
    expect(pet.animations.play).toHaveBeenLastCalledWith(
      "feed-enter",
      true,
    );

    expect(action.update(pet, 750)).toEqual({ status: "running" });
    expect(pet.animations.play).toHaveBeenLastCalledWith("feed-loop", true);

    expect(action.update(pet, 2_000)).toEqual({ status: "running" });
    expect(pet.animations.play).toHaveBeenLastCalledWith("feed-exit", true);

    expect(action.update(pet, 750)).toEqual({
      status: "complete",
      next: "idle",
    });
  });

  it("plays a once action for exactly one animation cycle", () => {
    const pet = context();
    const action = new ScheduledAnimationBehavior({
      id: "wave",
      capability: "wave",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 25_000,
    });

    action.enter(pet);

    expect(pet.animations.play).toHaveBeenCalledWith("wave", true);
    expect(action.update(pet, 749)).toEqual({ status: "running" });
    expect(action.update(pet, 1)).toEqual({
      status: "complete",
      next: "idle",
    });
  });

  it("runs a timed action for a random duration between two and five seconds", () => {
    const minimum = context(() => 0);
    const maximum = context(() => 1);
    const definition = {
      id: "waiting",
      capability: "waiting",
      category: "rest" as const,
      playback: "timed" as const,
      weight: 1,
      cooldownMs: 10_000,
      minDurationMs: 2_000,
      maxDurationMs: 5_000,
    };
    const minAction = new ScheduledAnimationBehavior(definition);
    const maxAction = new ScheduledAnimationBehavior(definition);

    minAction.enter(minimum);
    maxAction.enter(maximum);

    expect(minAction.update(minimum, 1_999)).toEqual({ status: "running" });
    expect(minAction.update(minimum, 1)).toMatchObject({ status: "complete" });
    expect(maxAction.update(maximum, 4_999)).toEqual({ status: "running" });
    expect(maxAction.update(maximum, 1)).toMatchObject({ status: "complete" });
  });

  it("returns to idle when activity is paused", () => {
    const pet = context();
    const action = new ScheduledAnimationBehavior({
      id: "wave",
      capability: "wave",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 25_000,
    });
    action.enter(pet);
    pet.paused = true;

    expect(action.update(pet, 16)).toEqual({
      status: "complete",
      next: "idle",
    });
  });

  it("marks the configured action cooldown", () => {
    const pet = context();
    pet.elapsedMs = 2_000;
    const action = new ScheduledAnimationBehavior({
      id: "wave",
      capability: "wave",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 25_000,
    });

    action.enter(pet);

    expect(pet.cooldowns.isReady("wave", 26_999)).toBe(false);
    expect(pet.cooldowns.isReady("wave", 27_000)).toBe(true);
  });
});

describe("DragAndDropBehavior", () => {
  it("plays the pet's picked-up pose while dragging", () => {
    const pet = context();
    pet.behaviorProfile = {
      ...pet.behaviorProfile,
      interaction: {
        ...pet.behaviorProfile.interaction,
        pickedUpCapability: "pickedUp",
      },
    };

    new DragAndDropBehavior().enter(pet);

    expect(pet.animations.play).toHaveBeenCalledWith("pickedUp");
  });

  it("preserves the pointer offset and clamps to the work area", () => {
    const pet = context();
    pet.drag = {
      active: true,
      pointer: { x: 490, y: 390 },
      offset: { x: 20, y: 30 },
    };
    const drag = new DragAndDropBehavior();
    drag.enter(pet);

    expect(drag.update(pet, 16)).toEqual({ status: "running" });
    expect(pet.position).toEqual({ x: 400, y: 280 });
  });

  it("records an activity anchor and lands when the pointer is released", () => {
    const pet = context();
    pet.position = { x: 145, y: 90 };
    pet.drag.active = false;
    const drag = new DragAndDropBehavior();

    expect(drag.update(pet, 16)).toEqual({
      status: "complete",
      next: "landing",
    });
    expect(pet.activityAnchor).toEqual({ x: 145, y: 90 });
  });

  it("replaces the previous activity anchor after another drag", () => {
    const pet = context();
    pet.activityAnchor = { x: 40, y: 60 };
    pet.position = { x: 210, y: 130 };
    pet.drag.active = false;

    new DragAndDropBehavior().update(pet, 16);

    expect(pet.activityAnchor).toEqual({ x: 210, y: 130 });
  });
});

describe("LandingBehavior", () => {
  it("plays one landing cycle and then returns to idle", () => {
    const pet = context();
    pet.behaviorProfile = {
      ...pet.behaviorProfile,
      interaction: {
        ...pet.behaviorProfile.interaction,
        landCapability: "land",
      },
    };
    const landing = new LandingBehavior();

    landing.enter(pet);

    expect(pet.animations.play).toHaveBeenCalledWith("land", true);
    expect(landing.update(pet, 749)).toEqual({ status: "running" });
    expect(landing.update(pet, 1)).toEqual({
      status: "complete",
      next: "idle",
    });
  });

  it("falls back to idle when landing art is unavailable", () => {
    const pet = context();
    pet.animations.hasCapability = (capability) => capability === "idle";
    const landing = new LandingBehavior();

    landing.enter(pet);

    expect(pet.animations.play).toHaveBeenCalledWith("idle", true);
  });
});

describe("FallToGroundBehavior", () => {
  it("lands without overshooting and returns to idle", () => {
    const pet = context();
    pet.position.y = 100;
    const fall = new FallToGroundBehavior();
    fall.enter(pet);

    expect(fall.update(pet, 100)).toEqual({ status: "running" });
    expect(pet.position.y).toBeGreaterThan(100);
    expect(fall.update(pet, 10_000)).toEqual({
      status: "complete",
      next: "idle",
    });
    expect(pet.position.y).toBe(280);
  });
});
