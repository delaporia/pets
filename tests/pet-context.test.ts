import { describe, expect, it } from "vitest";

import {
  clampPosition,
  type PetContext,
} from "../src/app/runtime/pet-context";

describe("clampPosition", () => {
  it("keeps the visible sprite bounds on screen while ignoring transparent padding", () => {
    const context = {
      workArea: { x: 100, y: 50, width: 800, height: 600 },
      windowSize: { width: 192, height: 208 },
      visualBounds: { left: 5, top: 3, right: 187, bottom: 203 },
    } as PetContext;

    expect(clampPosition(context, { x: -500, y: -500 })).toEqual({
      x: 95,
      y: 47,
    });
    expect(clampPosition(context, { x: 2_000, y: 2_000 })).toEqual({
      x: 713,
      y: 447,
    });
  });

  it("falls back to the complete window for legacy contexts", () => {
    const context = {
      workArea: { x: 100, y: 50, width: 800, height: 600 },
      windowSize: { width: 192, height: 208 },
    } as PetContext;

    expect(clampPosition(context, { x: -500, y: 2_000 })).toEqual({
      x: 100,
      y: 442,
    });
  });
});
