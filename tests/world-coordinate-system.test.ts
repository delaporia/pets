import { describe, expect, it } from "vitest";

import { WorldCoordinateSystem } from "../src/app/stage/world-coordinate-system";

describe("WorldCoordinateSystem", () => {
  it("preserves world positions while fitting padded content", () => {
    const coordinates = new WorldCoordinateSystem({
      x: 0,
      y: 0,
      width: 1_440,
      height: 900,
    });

    coordinates.fit(
      { x: 1_120, y: 650, width: 260, height: 190 },
      24,
    );

    expect(coordinates.viewport).toEqual({
      x: 1_096,
      y: 626,
      width: 308,
      height: 238,
    });
    expect(
      coordinates.worldToLocal({ x: 1_120, y: 650 }),
    ).toEqual({ x: 24, y: 24 });
    expect(coordinates.localToWorld({ x: 24, y: 24 })).toEqual({
      x: 1_120,
      y: 650,
    });
  });

  it("shifts the viewport inside an offset work area without shrinking content", () => {
    const coordinates = new WorldCoordinateSystem({
      x: -1_920,
      y: 25,
      width: 1_920,
      height: 1_055,
    });

    coordinates.fit(
      { x: -1_890, y: 970, width: 260, height: 100 },
      20,
    );

    expect(coordinates.viewport).toEqual({
      x: -1_910,
      y: 940,
      width: 300,
      height: 140,
    });
  });

  it("limits an oversized viewport to the work area", () => {
    const coordinates = new WorldCoordinateSystem({
      x: 100,
      y: 50,
      width: 800,
      height: 600,
    });

    coordinates.fit(
      { x: -200, y: -300, width: 1_600, height: 1_200 },
      32,
    );

    expect(coordinates.viewport).toEqual({
      x: 100,
      y: 50,
      width: 800,
      height: 600,
    });
  });

  it("rounds fractional content outward to whole canvas pixels", () => {
    const coordinates = new WorldCoordinateSystem({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });

    coordinates.fit(
      { x: 10.25, y: 20.5, width: 100.2, height: 50.1 },
      10,
    );

    expect(coordinates.viewport).toEqual({
      x: 0,
      y: 10,
      width: 121,
      height: 71,
    });
  });

  it("rejects invalid content bounds and padding", () => {
    const coordinates = new WorldCoordinateSystem({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });

    expect(() =>
      coordinates.fit({ x: 0, y: 0, width: 0, height: 20 }, 4),
    ).toThrow("Content bounds must have positive dimensions");
    expect(() =>
      coordinates.fit({ x: 0, y: 0, width: 20, height: 20 }, -1),
    ).toThrow("Stage padding must be non-negative");
  });
});
