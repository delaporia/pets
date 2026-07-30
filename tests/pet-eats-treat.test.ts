import { describe, expect, it } from "vitest";

import { createPetEatsTreatScene } from "../src/app/scenes/pet-eats-treat";

describe("pet eats treat scene", () => {
  it("builds a complete short feeding narrative with an independent treat", () => {
    const scene = createPetEatsTreatScene({
      origin: { x: 400, y: 720 },
      direction: "right",
    });

    expect(scene.durationMs).toBe(6_500);
    expect(scene.events.map(({ id, atMs }) => [id, atMs])).toEqual([
      ["treat-enter", 0],
      ["notice", 700],
      ["approach", 1_800],
      ["lick", 2_600],
      ["satisfied", 5_000],
      ["treat-exit", 5_800],
    ]);
    expect(scene.entities.map(({ id, kind }) => [id, kind])).toEqual([
      ["pet-feed-shadow", "shadow"],
      ["treat-dish", "prop"],
      ["treat-stick", "prop"],
      ["treat-sparkle", "effect"],
    ]);
    const entityIds = new Set([
      scene.settlement.petEntityId,
      ...scene.entities.map(({ id }) => id),
    ]);
    expect(
      scene.transformTracks.every(({ entityId }) => entityIds.has(entityId)),
    ).toBe(true);
    expect(scene.settlement.petPosition).toEqual({
      x: 445,
      y: 720,
    });
  });

  it("mirrors the approach and prop placement to the left", () => {
    const right = createPetEatsTreatScene({
      origin: { x: 500, y: 720 },
      direction: "right",
    });
    const left = createPetEatsTreatScene({
      origin: { x: 500, y: 720 },
      direction: "left",
    });
    const rightTreat = right.transformTracks.find(
      ({ entityId }) => entityId === "treat-stick",
    )!;
    const leftTreat = left.transformTracks.find(
      ({ entityId }) => entityId === "treat-stick",
    )!;

    expect(right.settlement.petPosition.x).toBe(545);
    expect(left.settlement.petPosition.x).toBe(455);
    expect(rightTreat.keyframes[1]!.value.position.x).toBeGreaterThan(500);
    expect(leftTreat.keyframes[1]!.value.position.x).toBeLessThan(500);
    const rightPet = right.transformTracks.find(
      ({ entityId }) => entityId === "pet",
    )!;
    const leftPet = left.transformTracks.find(
      ({ entityId }) => entityId === "pet",
    )!;
    expect(rightPet.keyframes.every(({ value }) => value.scale.x > 0)).toBe(
      true,
    );
    expect(leftPet.keyframes.every(({ value }) => value.scale.x < 0)).toBe(
      true,
    );
  });

  it("accepts a boundary-clamped approach distance", () => {
    const scene = createPetEatsTreatScene({
      origin: { x: 500, y: 720 },
      direction: "right",
      approachDistancePx: 18,
    });

    expect(scene.settlement.petPosition.x).toBe(518);
  });

  it("uses dedicated feeding beats that every pet can personalize", () => {
    const scene = createPetEatsTreatScene({
      origin: { x: 400, y: 720 },
      direction: "right",
    });
    const track = scene.animationTracks.find(
      ({ entityId }) => entityId === "pet",
    )!;

    expect(track.keyframes.map(({ clip, atMs }) => [clip, atMs])).toEqual([
      ["idle", 0],
      ["treatNotice", 700],
      ["treatApproach", 1_800],
      ["treatEat", 2_600],
      ["treatFinish", 5_000],
      ["idle", 5_800],
    ]);
  });

  it("can play the shared feeding scene on another pet actor", () => {
    const scene = createPetEatsTreatScene({
      origin: { x: 400, y: 720 },
      direction: "left",
      petEntityId: "wuyi",
    });

    expect(scene.settlement.petEntityId).toBe("wuyi");
    expect(
      scene.animationTracks.some(
        ({ entityId }) => entityId === "wuyi",
      ),
    ).toBe(true);
    expect(
      scene.transformTracks.some(
        ({ entityId }) => entityId === "treat-dish",
      ),
    ).toBe(true);
  });
});
