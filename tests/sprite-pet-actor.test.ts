import { describe, expect, it } from "vitest";

import type { LoadedPet } from "../src/app/pets/pet-loader";
import type { PetManifest } from "../src/app/pets/schemas";
import {
  createSpritePetActor,
  spriteFrameFor,
  spriteFrameForGaze,
} from "../src/app/stage/sprite-pet-actor";

function loadedPet(): LoadedPet {
  const image = {} as HTMLImageElement;
  return {
    manifest: {
      id: "ying",
      display: {
        scale: 0.6,
        visualBounds: {
          left: 5,
          top: 3,
          right: 187,
          bottom: 203,
        },
        footAnchor: { x: 96, y: 202 },
      },
      atlases: {
        main: {
          path: "spritesheet.webp",
          cellWidth: 192,
          cellHeight: 208,
          columns: 8,
          rows: 2,
        },
      },
      animations: {
        idle: {
          atlas: "main",
          row: 0,
          frames: [0, 1, 2],
          fps: 4,
          loop: true,
        },
        lookUpper: {
          atlas: "main",
          row: 1,
          frames: [0, 1, 2, 3, 4, 5, 6, 7],
          fps: 4,
          loop: false,
        },
        lookLower: {
          atlas: "main",
          row: 2,
          frames: [0, 1, 2, 3, 4, 5, 6, 7],
          fps: 4,
          loop: false,
        },
      },
      capabilities: {
        idle: "idle",
        lookUpper: "lookUpper",
        lookLower: "lookLower",
      },
    } as unknown as PetManifest,
    images: new Map([["main", image]]),
  };
}

describe("sprite pet actor", () => {
  it("anchors scaled visual bounds to the pet foot in world coordinates", () => {
    const actor = createSpritePetActor(
      loadedPet(),
      { x: 600, y: 720 },
      1.25,
    );

    expect(actor.visual).toBe("pet-sprite");
    expect(actor.transform.position).toEqual({ x: 600, y: 720 });
    expect(actor.localBounds).toEqual({
      x: -68.25,
      y: -149.25,
      width: 136.5,
      height: 150,
    });
    expect(actor.animation).toEqual({
      clip: "idle",
      loop: true,
      elapsedMs: 0,
    });
  });

  it("selects the atlas cell from elapsed animation time", () => {
    const pet = loadedPet();

    expect(
      spriteFrameFor(pet, {
        clip: "idle",
        loop: true,
        elapsedMs: 500,
      }),
    ).toEqual({
      image: pet.images.get("main"),
      atlasId: "main",
      row: 0,
      column: 2,
      cellWidth: 192,
      cellHeight: 208,
    });
  });

  it("rejects a missing clip instead of drawing a stale frame", () => {
    expect(() =>
      spriteFrameFor(loadedPet(), {
        clip: "missing",
        loop: false,
        elapsedMs: 0,
      }),
    ).toThrow('Unknown sprite animation "missing"');
  });

  it("selects one of sixteen dedicated gaze frames", () => {
    const pet = loadedPet();

    expect(spriteFrameForGaze(pet, 13)).toEqual({
      image: pet.images.get("main"),
      atlasId: "main",
      row: 2,
      column: 5,
      cellWidth: 192,
      cellHeight: 208,
    });
  });
});
