import type { Point } from "../stage/geometry";

export interface CubicBezierPath {
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
}

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

export function sampleCubicBezier(
  path: CubicBezierPath,
  progress: number,
): Point {
  const t = clampProgress(progress);
  const inverse = 1 - t;
  const startWeight = inverse ** 3;
  const control1Weight = 3 * inverse ** 2 * t;
  const control2Weight = 3 * inverse * t ** 2;
  const endWeight = t ** 3;
  return {
    x:
      path.start.x * startWeight +
      path.control1.x * control1Weight +
      path.control2.x * control2Weight +
      path.end.x * endWeight,
    y:
      path.start.y * startWeight +
      path.control1.y * control1Weight +
      path.control2.y * control2Weight +
      path.end.y * endWeight,
  };
}

export function sampleCubicBezierTangent(
  path: CubicBezierPath,
  progress: number,
): Point {
  const t = clampProgress(progress);
  const inverse = 1 - t;
  let x =
    3 * inverse ** 2 * (path.control1.x - path.start.x) +
    6 * inverse * t * (path.control2.x - path.control1.x) +
    3 * t ** 2 * (path.end.x - path.control2.x);
  let y =
    3 * inverse ** 2 * (path.control1.y - path.start.y) +
    6 * inverse * t * (path.control2.y - path.control1.y) +
    3 * t ** 2 * (path.end.y - path.control2.y);
  let length = Math.hypot(x, y);
  if (length === 0) {
    x = path.end.x - path.start.x;
    y = path.end.y - path.start.y;
    length = Math.hypot(x, y);
  }
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: x / length, y: y / length };
}
