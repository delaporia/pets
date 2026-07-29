import { describe, expect, it } from "vitest";

import {
  sampleCubicBezier,
  sampleCubicBezierTangent,
  type CubicBezierPath,
} from "../src/app/scenes/bezier-path";

const path: CubicBezierPath = {
  start: { x: 10, y: 80 },
  control1: { x: 30, y: 10 },
  control2: { x: 90, y: 10 },
  end: { x: 110, y: 80 },
};

describe("cubic Bezier path", () => {
  it("returns exact endpoints", () => {
    expect(sampleCubicBezier(path, 0)).toEqual({ x: 10, y: 80 });
    expect(sampleCubicBezier(path, 1)).toEqual({ x: 110, y: 80 });
  });

  it("samples a hand-calculated midpoint", () => {
    expect(sampleCubicBezier(path, 0.5)).toEqual({ x: 60, y: 27.5 });
  });

  it("returns a normalized forward tangent", () => {
    const tangent = sampleCubicBezierTangent(path, 0.5);

    expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1);
    expect(tangent.x).toBeCloseTo(1);
    expect(tangent.y).toBeCloseTo(0);
  });

  it("clamps progress outside the path", () => {
    expect(sampleCubicBezier(path, -2)).toEqual(path.start);
    expect(sampleCubicBezier(path, 4)).toEqual(path.end);
  });
});
