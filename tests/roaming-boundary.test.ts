import { describe, expect, it } from "vitest";

import {
  movementWithinRoamingBounds,
  roamingBoundsFor,
} from "../src/app/stage/roaming-boundary";

describe("roaming boundary", () => {
  const workArea = { x: -1_440, y: 0, width: 2_880, height: 900 };

  it("centers movement around the last user drop position", () => {
    expect(
      roamingBoundsFor({ x: 400, y: 700 }, 180, workArea),
    ).toEqual({ minimumX: 220, maximumX: 580 });
  });

  it("clips the roaming range at negative-coordinate screen edges", () => {
    expect(
      roamingBoundsFor({ x: -1_400, y: 700 }, 180, workArea, 60),
    ).toEqual({ minimumX: -1_380, maximumX: -1_220 });
  });

  it("chooses a distance that never crosses the fixed range", () => {
    const bounds = { minimumX: 220, maximumX: 580 };
    expect(
      movementWithinRoamingBounds(
        { x: 560, y: 700 },
        bounds,
        140,
        () => 0.9,
      ),
    ).toEqual({ direction: "left", distance: 140 });
    expect(
      movementWithinRoamingBounds(
        { x: 400, y: 700 },
        bounds,
        240,
        () => 0.9,
      ),
    ).toEqual({ direction: "right", distance: 180 });
  });
});
