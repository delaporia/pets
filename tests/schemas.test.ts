import { describe, expect, it } from "vitest";

import { parseCatalog, parsePetManifest } from "../src/app/pets/schemas";

const validPet = {
  schemaVersion: 1,
  id: "wuyi",
  displayName: "Wuyi",
  description: "A desktop companion",
  spriteVersionNumber: 2,
  display: { scale: 0.6 },
  atlases: {
    main: {
      path: "spritesheet.webp",
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 11,
    },
  },
  animations: {
    idle: {
      atlas: "main",
      row: 0,
      frames: [0, 1, 2, 3, 4, 5],
      fps: 8,
      loop: true,
    },
    walkRight: {
      atlas: "main",
      row: 1,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      fps: 10,
      loop: true,
    },
    walkLeft: {
      atlas: "main",
      row: 2,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      fps: 10,
      loop: true,
    },
    wave: {
      atlas: "main",
      row: 3,
      frames: [0, 1],
      fps: 8,
      loop: false,
    },
    waiting: {
      atlas: "main",
      row: 4,
      frames: [0, 1],
      fps: 8,
      loop: true,
    },
  },
  capabilities: {
    idle: "idle",
    walkRight: "walkRight",
    walkLeft: "walkLeft",
    wave: "wave",
    observe: "waiting",
  },
  actions: {
    idle: { loop: "idle" },
    walkLeft: { loop: "walkLeft" },
    walkRight: { loop: "walkRight" },
    look: { loop: "waiting" },
    pet: { loop: "wave" },
    feed: {
      enter: "wave",
      loop: "waiting",
      exit: "idle",
      loopDuration: { minMs: 4_000, maxMs: 8_000 },
    },
    sleep: {
      enter: "wave",
      loop: "waiting",
      exit: "idle",
      loopDuration: { minMs: 30_000, maxMs: 120_000 },
    },
    groom: {
      loop: "waiting",
      loopDuration: { minMs: 5_000, maxMs: 12_000 },
    },
    stretch: { loop: "wave" },
    play: { loop: "wave" },
    pickedUp: { loop: "idle" },
    land: { loop: "idle" },
  },
  autonomousActions: [
    { capability: "wave", playback: "once" },
    {
      capability: "observe",
      playback: "timed",
      minDurationMs: 2_000,
      maxDurationMs: 5_000,
    },
  ],
};

const behaviorProfile = {
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
    rest: 40,
    social: 30,
  },
  actions: [
    {
      id: "soft-paw",
      capability: "wave",
      category: "social",
      playback: "once",
      weight: 1,
      cooldownMs: 25_000,
    },
    {
      id: "quiet-wait",
      capability: "observe",
      category: "rest",
      playback: "timed",
      weight: 2,
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
    singleClickAction: "soft-paw",
    multiClickAction: "quiet-wait",
    nearbyAction: "soft-paw",
    pickedUpCapability: "idle",
    landCapability: "idle",
  },
  fallbackCapabilities: ["idle"],
};

describe("pet manifest schema", () => {
  it("requires the complete shared semantic action contract", () => {
    const parsed = parsePetManifest(validPet);

    expect(Object.keys(parsed.actions)).toEqual([
      "idle",
      "walkLeft",
      "walkRight",
      "look",
      "pet",
      "feed",
      "sleep",
      "groom",
      "stretch",
      "play",
      "pickedUp",
      "land",
    ]);
  });

  it("rejects a pet missing a required semantic action", () => {
    const { feed: _feed, ...actionsWithoutFeed } = validPet.actions;

    expect(() =>
      parsePetManifest({ ...validPet, actions: actionsWithoutFeed }),
    ).toThrow(/actions\.feed/);
  });

  it("rejects a phased action referencing an unknown animation", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        actions: {
          ...validPet.actions,
          feed: { ...validPet.actions.feed, enter: "missing" },
        },
      }),
    ).toThrow(/actions\.feed\.enter/);
  });

  it("accepts data-driven interaction actions", () => {
    const parsed = parsePetManifest({
      ...validPet,
      interactionActions: {
        "feed-treat": {
          enter: "wave",
          loop: "waiting",
          exit: "idle",
          loopDuration: { minMs: 2_000, maxMs: 3_000 },
        },
      },
    });

    expect(parsed.interactionActions["feed-treat"]).toEqual({
      enter: "wave",
      loop: "waiting",
      exit: "idle",
      loopDuration: { minMs: 2_000, maxMs: 3_000 },
    });
  });

  it("accepts staged interaction timelines", () => {
    const parsed = parsePetManifest({
      ...validPet,
      interactionTimelines: {
        "feed-kibble": {
          stages: [
            {
              id: "approach",
              animation: "wave",
              durationMs: 900,
              propState: "bowl",
            },
            {
              id: "eat",
              animation: "waiting",
              durationMs: 2_400,
              propState: "eat",
            },
          ],
        },
      },
    });

    expect(parsed.interactionTimelines["feed-kibble"]?.stages).toHaveLength(2);
  });

  it("rejects timeline stages referencing unknown animations", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        interactionTimelines: {
          "feed-kibble": {
            stages: [
              { id: "eat", animation: "missing", durationMs: 1_000 },
            ],
          },
        },
      }),
    ).toThrow(/interactionTimelines\.feed-kibble\.stages\.0\.animation/);
  });

  it("rejects an interaction action referencing an unknown animation", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        interactionActions: {
          "feed-treat": { loop: "missing" },
        },
      }),
    ).toThrow(/interactionActions\.feed-treat\.loop/);
  });

  it("rejects a reversed phased loop duration", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        actions: {
          ...validPet.actions,
          groom: {
            loop: "waiting",
            loopDuration: { minMs: 9_000, maxMs: 2_000 },
          },
        },
      }),
    ).toThrow(/actions\.groom\.loopDuration\.maxMs/);
  });

  it("rejects legacy Codex capability names", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        capabilities: {
          ...validPet.capabilities,
          failed: "waiting",
        },
      }),
    ).toThrow(/legacy Codex capability "failed"/);
  });

  it("accepts a valid v1 pet manifest", () => {
    expect(parsePetManifest(validPet).id).toBe("wuyi");
  });

  it("rejects an unsupported schema version", () => {
    expect(() =>
      parsePetManifest({ ...validPet, schemaVersion: 2 }),
    ).toThrow(/schemaVersion/);
  });

  it("rejects a capability that references a missing animation", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        capabilities: { ...validPet.capabilities, idle: "missing" },
      }),
    ).toThrow(/capabilities\.idle/);
  });

  it("rejects an animation frame outside its atlas", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        animations: {
          ...validPet.animations,
          idle: { ...validPet.animations.idle, frames: [8] },
        },
      }),
    ).toThrow(/animations\.idle\.frames/);
  });

  it("accepts once and timed autonomous actions", () => {
    expect(parsePetManifest(validPet).autonomousActions).toEqual(
      validPet.autonomousActions,
    );
  });

  it("rejects an autonomous action with a missing capability", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        autonomousActions: [{ capability: "missing", playback: "once" }],
      }),
    ).toThrow(/autonomousActions\.0\.capability/);
  });

  it("rejects duplicate autonomous capabilities", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        autonomousActions: [
          { capability: "wave", playback: "once" },
          { capability: "wave", playback: "once" },
        ],
      }),
    ).toThrow(/unique/);
  });

  it("rejects a timed action whose maximum is below its minimum", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        autonomousActions: [
          {
            capability: "observe",
            playback: "timed",
            minDurationMs: 5_000,
            maxDurationMs: 2_000,
          },
        ],
      }),
    ).toThrow(/maxDurationMs/);
  });

  it("accepts a per-pet desktop behavior profile", () => {
    expect(
      parsePetManifest({ ...validPet, behaviorProfile }).behaviorProfile,
    ).toEqual(behaviorProfile);
  });

  it("rejects a behavior action with an unknown capability", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        behaviorProfile: {
          ...behaviorProfile,
          actions: [
            {
              ...behaviorProfile.actions[0],
              capability: "missing",
            },
          ],
        },
      }),
    ).toThrow(/behaviorProfile\.actions\.0\.capability/);
  });

  it("rejects a behavior interaction with an unknown action id", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        behaviorProfile: {
          ...behaviorProfile,
          interaction: {
            ...behaviorProfile.interaction,
            multiClickAction: "missing",
          },
        },
      }),
    ).toThrow(/behaviorProfile\.interaction\.multiClickAction/);
  });

  it("rejects reversed behavior duration ranges", () => {
    expect(() =>
      parsePetManifest({
        ...validPet,
        behaviorProfile: {
          ...behaviorProfile,
          movement: {
            ...behaviorProfile.movement,
            minDurationMs: 8_000,
            maxDurationMs: 3_000,
          },
        },
      }),
    ).toThrow(/behaviorProfile\.movement\.maxDurationMs/);
  });

  it("migrates legacy pets to a stable behavior profile", () => {
    const migrated = parsePetManifest(validPet).behaviorProfile;
    expect(migrated.scheduler.minIntervalMs).toBeGreaterThanOrEqual(6_000);
    expect(migrated.movement.walkSpeed).toBeGreaterThan(0);
    expect(migrated.fallbackCapabilities).toContain("idle");
  });
});

describe("pet catalog schema", () => {
  it("requires the default pet to be registered", () => {
    expect(() =>
      parseCatalog({
        schemaVersion: 1,
        defaultPet: "missing",
        pets: ["wuyi"],
      }),
    ).toThrow(/defaultPet/);
  });

  it("rejects duplicate pet ids", () => {
    expect(() =>
      parseCatalog({
        schemaVersion: 1,
        defaultPet: "wuyi",
        pets: ["wuyi", "wuyi"],
      }),
    ).toThrow(/unique/);
  });
});
