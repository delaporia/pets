import { describe, expect, it } from "vitest";

import { interactionSurfaceLayout } from "../src/app/interactions/interaction-surface-layout";

describe("interactionSurfaceLayout", () => {
  it("keeps the pet fixed and opens the wheel on its right", () => {
    expect(
      interactionSurfaceLayout(
        { x: 120, y: 600 },
        { width: 116, height: 125 },
        { x: 0, y: 0, width: 1_200, height: 800 },
      ),
    ).toEqual({
      side: "right",
      windowPosition: { x: 120, y: 600 },
      windowSize: { width: 276, height: 159 },
      petOrigin: { x: 0, y: 0 },
      statusOrigin: { x: 0, y: 127 },
    });
  });

  it("keeps the wheel on the right and temporarily shifts the group at the screen edge", () => {
    expect(
      interactionSurfaceLayout(
        { x: 1_052, y: 600 },
        { width: 116, height: 125 },
        { x: 0, y: 0, width: 1_200, height: 800 },
      ),
    ).toEqual({
      side: "right",
      windowPosition: { x: 924, y: 600 },
      windowSize: { width: 276, height: 159 },
      petOrigin: { x: 0, y: 0 },
      statusOrigin: { x: 0, y: 127 },
    });
  });

  it("temporarily lifts a bottom-docked pet so the status remains visible", () => {
    const layout = interactionSurfaceLayout(
      { x: 120, y: 675 },
      { width: 116, height: 125 },
      { x: 0, y: 0, width: 1_200, height: 800 },
    );

    expect(layout.windowPosition.y).toBe(641);
    expect(layout.statusOrigin.y).toBe(127);
  });
});
