import { describe, expect, it } from "vitest";

import { createPetPlaysWithToyScene } from "../src/app/scenes/pet-plays-with-toy";

describe("pet plays with toy scenes", () => {
  it.each([
    ["ball", "toy-ball"],
    ["wand", "toy-wand"],
  ] as const)("shows and animates the selected %s", (toy, propId) => {
    const scene = createPetPlaysWithToyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      toy,
      petEntityId: "ying",
    });

    expect(scene.durationMs).toBeGreaterThanOrEqual(6_000);
    expect(scene.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: propId,
          kind: "prop",
          visual: propId,
        }),
      ]),
    );
    expect(
      scene.entities.find(({ id }) => id === propId)?.layer,
    ).toBeGreaterThan(100);
    const propTrack = scene.transformTracks.find(
      ({ entityId }) => entityId === propId,
    );
    expect(propTrack?.keyframes.length).toBeGreaterThanOrEqual(5);
    expect(scene.animationTracks[0]?.entityId).toBe("ying");
    expect(scene.settlement.petEntityId).toBe("ying");
  });
});
