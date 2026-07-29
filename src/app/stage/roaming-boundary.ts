import type { Point, Rect } from "./geometry";

export interface HorizontalRoamingBounds {
  minimumX: number;
  maximumX: number;
}

export interface BoundedMovement {
  direction: "left" | "right";
  distance: number;
}

export function roamingBoundsFor(
  anchor: Point,
  halfWidth: number,
  workArea: Rect,
  edgeMargin = 80,
): HorizontalRoamingBounds {
  const workMinimum = workArea.x + edgeMargin;
  const workMaximum =
    workArea.x + workArea.width - edgeMargin;
  const minimumX = Math.max(
    workMinimum,
    anchor.x - Math.max(0, halfWidth),
  );
  const maximumX = Math.min(
    workMaximum,
    anchor.x + Math.max(0, halfWidth),
  );
  if (minimumX <= maximumX) {
    return { minimumX, maximumX };
  }
  const center = Math.min(
    workMaximum,
    Math.max(workMinimum, anchor.x),
  );
  return { minimumX: center, maximumX: center };
}

export function movementWithinRoamingBounds(
  origin: Point,
  bounds: HorizontalRoamingBounds,
  preferredDistance: number,
  random: () => number = Math.random,
): BoundedMovement {
  const right = Math.max(0, bounds.maximumX - origin.x);
  const left = Math.max(0, origin.x - bounds.minimumX);
  const usefulDistance = Math.min(40, preferredDistance);
  const direction =
    right < usefulDistance && left > right
      ? "left"
      : left < usefulDistance && right > left
        ? "right"
        : random() >= 0.5
          ? "right"
          : "left";
  return {
    direction,
    distance: Math.min(
      Math.max(0, preferredDistance),
      direction === "right" ? right : left,
    ),
  };
}
