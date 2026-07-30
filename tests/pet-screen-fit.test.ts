import { describe, expect, it } from "vitest";

import type { LoadedPet } from "../src/app/pets/pet-loader";
import type { StageEntity } from "../src/app/stage/entity";
import {
  clampEntityPositionToWorkArea,
  fittedPetScale,
} from "../src/app/stage/pet-screen-fit";

function loadedPet(): LoadedPet {
  return {
    manifest: {
      id: "screen-fit",
      displayName: "Screen Fit",
      capabilities: { idle: "idle" },
      animations: {
        idle: {
          atlas: "main",
          row: 0,
          frames: [0],
          fps: 1,
          loop: true,
        },
      },
      atlases: {
        main: {
          path: "main.webp",
          columns: 1,
          rows: 1,
          cellWidth: 192,
          cellHeight: 208,
        },
      },
      display: {
        scale: 0.6,
        visualBounds: {
          left: 5,
          top: 5,
          right: 187,
          bottom: 203,
        },
      },
    },
    images: new Map(),
  } as unknown as LoadedPet;
}

describe("pet screen fitting", () => {
  it("keeps a requested 300% scale when the work area can contain it", () => {
    expect(
      fittedPetScale(
        loadedPet(),
        3,
        { x: 0, y: 0, width: 1_440, height: 900 },
      ),
    ).toBe(3);
  });

  it("caps a requested scale so the full visual bounds and padding fit", () => {
    const scale = fittedPetScale(
      loadedPet(),
      3,
      { x: 0, y: 0, width: 320, height: 300 },
    );

    expect(scale).toBeLessThan(3);
    expect(182 * 0.6 * scale + 56).toBeLessThanOrEqual(320);
    expect(198 * 0.6 * scale + 56).toBeLessThanOrEqual(300);
  });

  it("clamps mirrored pet bounds fully inside an offset work area", () => {
    const entity = {
      localBounds: { x: -30, y: -100, width: 100, height: 100 },
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: -1, y: 1 },
        rotation: 0,
        alpha: 1,
      },
    } as StageEntity;

    expect(
      clampEntityPositionToWorkArea(
        entity,
        { x: 100, y: 50, width: 800, height: 600 },
        { x: -500, y: 2_000 },
      ),
    ).toEqual({ x: 170, y: 650 });
  });
});
