import { describe, expect, it } from "vitest";

import {
  BodyInteractionTracker,
  identifyPetBodyZone,
} from "../src/app/interactions/body-interaction";

describe("pet body interaction", () => {
  it("gives the tail priority over the body where their regions overlap", () => {
    expect(identifyPetBodyZone({ x: 0.86, y: 0.68 })).toBe("tail");
  });

  it("recognizes a gentle head stroke from its path and duration", () => {
    const tracker = new BodyInteractionTracker(identifyPetBodyZone);

    tracker.start({ x: 0.42, y: 0.18 }, 0);
    tracker.move({ x: 0.47, y: 0.2 }, 350);
    tracker.move({ x: 0.52, y: 0.22 }, 760);

    expect(tracker.finish({ x: 0.56, y: 0.23 }, 1_100)).toEqual({
      zone: "head",
      gesture: "stroke",
      intensity: "gentle",
      durationMs: 1_100,
    });
  });

  it("recognizes fast tail movement as an excited tease", () => {
    const tracker = new BodyInteractionTracker(identifyPetBodyZone);

    tracker.start({ x: 0.82, y: 0.66 }, 0);
    tracker.move({ x: 0.94, y: 0.61 }, 80);

    expect(tracker.finish({ x: 0.8, y: 0.7 }, 150)).toEqual({
      zone: "tail",
      gesture: "tease",
      intensity: "excited",
      durationMs: 150,
    });
  });

  it("ignores a gesture that leaves its starting body region", () => {
    const tracker = new BodyInteractionTracker(identifyPetBodyZone);

    tracker.start({ x: 0.45, y: 0.18 }, 0);

    expect(tracker.finish({ x: 0.1, y: 0.9 }, 500)).toBeNull();
  });

  it("does not emit a reaction after interaction mode is cancelled", () => {
    const tracker = new BodyInteractionTracker(identifyPetBodyZone);

    tracker.start({ x: 0.45, y: 0.18 }, 0);
    tracker.cancel();

    expect(tracker.finish({ x: 0.55, y: 0.2 }, 600)).toBeNull();
  });
});
