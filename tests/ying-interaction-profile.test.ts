import { describe, expect, it } from "vitest";

import {
  interactionForYingBody,
  interactionForYingSecondary,
  semanticActionForYingBodyInteraction,
  semanticActionForYingSecondary,
} from "../src/app/interactions/ying-interaction-profile";

describe("Ying interaction profile", () => {
  it.each(["treat", "kibble", "can"] as const)(
    "maps %s to feeding",
    (option) => {
      expect(semanticActionForYingSecondary(option)).toBe("feed");
    },
  );

  it.each(["ball", "butterfly", "wand"] as const)(
    "maps %s to play",
    (option) => {
      expect(semanticActionForYingSecondary(option)).toBe("play");
    },
  );

  it("responds warmly to a gentle head stroke", () => {
    expect(
      semanticActionForYingBodyInteraction({
        zone: "head",
        gesture: "stroke",
        intensity: "gentle",
        durationMs: 1_100,
      }),
    ).toBe("pet");
  });

  it("turns tail teasing into a playful reaction", () => {
    expect(
      semanticActionForYingBodyInteraction({
        zone: "tail",
        gesture: "tease",
        intensity: "excited",
        durationMs: 150,
      }),
    ).toBe("play");
  });

  it.each([
    ["treat", "feed", "feed-treat", "treat"],
    ["kibble", "feed", "feed-kibble", "kibble"],
    ["can", "feed", "feed-can", "can"],
    ["ball", "play", "play-ball", "ball"],
    ["butterfly", "play", "play-butterfly", "butterfly"],
    ["wand", "play", "play-wand", "wand"],
  ] as const)(
    "gives %s its own behavior and prop cue",
    (option, careAction, behaviorId, prop) => {
      expect(interactionForYingSecondary(option)).toEqual({
        careAction,
        behaviorId,
        prop,
      });
    },
  );

  it("uses distinct body reactions by region and temperament", () => {
    expect(
      interactionForYingBody({
        zone: "chin",
        gesture: "scratch",
        intensity: "gentle",
        durationMs: 900,
      }),
    ).toMatchObject({
      careAction: "pet",
      behaviorId: "touch-chin",
      feedback: "pleased",
    });
    expect(
      interactionForYingBody({
        zone: "tail",
        gesture: "tease",
        intensity: "excited",
        durationMs: 180,
      }),
    ).toMatchObject({
      careAction: "play",
      behaviorId: "touch-tail",
      feedback: "mischief",
    });
  });
});
