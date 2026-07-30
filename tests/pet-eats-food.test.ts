import { describe, expect, it } from "vitest";

import { createPetEatsFoodScene } from "../src/app/scenes/pet-eats-treat";

describe("pet eats food scenes", () => {
  it.each([
    ["treat", "treat-stick"],
    ["kibble", "kibble-bowl"],
    ["can", "wet-food-can"],
  ] as const)("shows the selected %s prop", (food, propId) => {
    const scene = createPetEatsFoodScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      food,
    });

    expect(scene.id).toContain(food);
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
    expect(
      scene.transformTracks.some(({ entityId }) => entityId === propId),
    ).toBe(true);
  });
});
