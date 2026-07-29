import { describe, expect, it } from "vitest";

import { interactionWheelLayout } from "../src/app/interactions/interaction-wheel-layout";

function overlaps(
  left: { x: number; y: number; size: number },
  right: { x: number; y: number; size: number },
): boolean {
  return (
    Math.abs(left.x - right.x) < (left.size + right.size) / 2 &&
    Math.abs(left.y - right.y) < (left.size + right.size) / 2
  );
}

describe("interaction wheel layout", () => {
  it("keeps all four primary choices visually separate", () => {
    const placements = interactionWheelLayout("primary", 4, "right");

    for (let left = 0; left < placements.length; left += 1) {
      for (let right = left + 1; right < placements.length; right += 1) {
        expect(
          overlaps(
            { ...placements[left]!, size: 42 },
            { ...placements[right]!, size: 42 },
          ),
        ).toBe(false);
      }
    }
  });

  it("mirrors the arc and centers a single secondary choice", () => {
    expect(interactionWheelLayout("secondary", 1, "right")).toEqual([
      { x: 54, y: 0 },
    ]);
    expect(interactionWheelLayout("secondary", 1, "left")).toEqual([
      { x: -54, y: 0 },
    ]);
  });

  it("distributes two and three secondary choices without overlap", () => {
    expect(interactionWheelLayout("secondary", 2, "right")).toEqual([
      { x: 54, y: -24 },
      { x: 54, y: 24 },
    ]);
    expect(interactionWheelLayout("secondary", 3, "right")).toEqual([
      { x: 54, y: -48 },
      { x: 54, y: 0 },
      { x: 54, y: 48 },
    ]);
  });
});
