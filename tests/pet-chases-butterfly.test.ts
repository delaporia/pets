import { describe, expect, it } from "vitest";

import { createPetChasesButterflyScene } from "../src/app/scenes/pet-chases-butterfly";
import { petSceneMotionProfileFor } from "../src/app/scenes/pet-scene-motion-profile";

describe("pet chases butterfly scene", () => {
  it("builds a complete eight-second narrative with independent props", () => {
    const scene = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      distance: "mid",
      pathVariant: 1,
      endingVariant: "escape",
    });

    expect(scene.durationMs).toBe(8_200);
    expect(scene.events.map(({ id, atMs }) => [id, atMs])).toEqual([
      ["butterfly-enter", 0],
      ["notice", 700],
      ["stalk", 1_500],
      ["chase", 2_500],
      ["pounce", 5_000],
      ["escape", 6_000],
      ["outro", 6_800],
    ]);
    expect(scene.entities.map(({ id, kind }) => [id, kind])).toEqual([
      ["pet-shadow", "shadow"],
      ["butterfly", "prop"],
      ["butterfly-trail", "effect"],
    ]);
    expect(scene.settlement).toEqual({
      petEntityId: "pet",
      petPosition: { x: 620, y: 720 },
    });
  });

  it("mirrors the real endpoint for a leftward chase", () => {
    const right = createPetChasesButterflyScene({
      origin: { x: 600, y: 720 },
      direction: "right",
      distance: "near",
      pathVariant: 1,
      endingVariant: "caught",
    });
    const left = createPetChasesButterflyScene({
      origin: { x: 600, y: 720 },
      direction: "left",
      distance: "near",
      pathVariant: 1,
      endingVariant: "caught",
    });

    expect(right.settlement.petPosition.x).toBe(740);
    expect(left.settlement.petPosition.x).toBe(460);
    expect(right.settlement.petPosition.y).toBe(720);
    expect(left.settlement.petPosition.y).toBe(720);
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

  it("accepts a boundary-clamped chase distance", () => {
    const scene = createPetChasesButterflyScene({
      origin: { x: 500, y: 720 },
      direction: "right",
      distance: "near",
      distancePx: 63,
      pathVariant: 1,
      endingVariant: "escape",
    });

    expect(scene.settlement.petPosition.x).toBe(563);
  });

  it("changes the butterfly flight path and ending without changing scene beats", () => {
    const lowEscape = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      distance: "mid",
      pathVariant: 1,
      endingVariant: "escape",
    });
    const highCatch = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      distance: "mid",
      pathVariant: 2,
      endingVariant: "caught",
    });
    const lowButterfly = lowEscape.transformTracks.find(
      ({ entityId }) => entityId === "butterfly",
    )!;
    const highButterfly = highCatch.transformTracks.find(
      ({ entityId }) => entityId === "butterfly",
    )!;

    expect(
      lowButterfly.keyframes[1]?.value.position.y,
    ).not.toBe(highButterfly.keyframes[1]?.value.position.y);
    expect(
      lowButterfly.keyframes.at(-1)?.value.alpha,
    ).toBe(0);
    expect(
      highButterfly.keyframes.at(-1)?.value.alpha,
    ).toBe(1);
    expect(lowEscape.events.map(({ atMs }) => atMs)).toEqual(
      highCatch.events.map(({ atMs }) => atMs),
    );
  });

  it("uses personality-ready butterfly beats for every built-in pet", () => {
    const scene = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      distance: "near",
      pathVariant: 1,
      endingVariant: "escape",
      petEntityId: "duobi",
    });
    const petTrack = scene.animationTracks.find(
      ({ entityId }) => entityId === "duobi",
    )!;

    expect(
      new Set(petTrack.keyframes.map(({ clip }) => clip)),
    ).toEqual(
      new Set([
        "idle",
        "butterflyNotice",
        "butterflyCrouch",
        "butterflyRun",
        "butterflyPounce",
        "butterflyLand",
      ]),
    );
  });

  it("uses dedicated phase animations instead of one looping run clip", () => {
    const scene = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "left",
      distance: "mid",
      pathVariant: 2,
      endingVariant: "escape",
    });
    const yingTrack = scene.animationTracks.find(
      ({ entityId }) => entityId === "pet",
    )!;

    expect(yingTrack.keyframes.map(({ clip, atMs }) => [clip, atMs]))
      .toEqual([
        ["idle", 0],
        ["butterflyNotice", 700],
        ["butterflyCrouch", 1_500],
        ["butterflyRun", 2_500],
        ["butterflyPounce", 5_000],
        ["butterflyLand", 6_000],
        ["idle", 6_800],
      ]);
  });

  it("can target another pet actor while keeping the shared scene structure", () => {
    const scene = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      distance: "near",
      pathVariant: 1,
      endingVariant: "escape",
      petEntityId: "duobi",
    });

    expect(scene.settlement.petEntityId).toBe("duobi");
    expect(
      scene.transformTracks.some(
        ({ entityId }) => entityId === "duobi",
      ),
    ).toBe(true);
  });

  it("coordinates crouch, running cadence, pounce, and landing transforms", () => {
    const scene = createPetChasesButterflyScene({
      origin: { x: 400, y: 720 },
      direction: "right",
      distance: "mid",
      pathVariant: 1,
      endingVariant: "escape",
      motion: petSceneMotionProfileFor("ying"),
    });
    const petTrack = scene.transformTracks.find(
      ({ entityId }) => entityId === "pet",
    )!;

    expect(petTrack.keyframes.length).toBeGreaterThanOrEqual(11);
    expect(
      petTrack.keyframes.find(({ atMs }) => atMs === 1_500)?.value
        .scale.y,
    ).toBeLessThan(1);
    expect(
      petTrack.keyframes.find(({ atMs }) => atMs === 5_000)?.value
        .scale.y,
    ).toBeGreaterThan(1);
    expect(
      petTrack.keyframes.find(({ atMs }) => atMs === 6_000)?.value
        .scale.y,
    ).toBeLessThan(1);
    expect(petTrack.keyframes.at(-1)?.value.scale).toEqual({
      x: 1,
      y: 1,
    });
  });
});
