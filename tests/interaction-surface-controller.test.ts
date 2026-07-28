import { describe, expect, it } from "vitest";

import { InteractionSurfaceController } from "../src/app/interactions/interaction-surface-controller";

describe("InteractionSurfaceController", () => {
  it("expands beside the pet and restores the original pet window", async () => {
    const root = document.createElement("div");
    const viewport = {
      width: 116,
      height: 125,
      origin: { x: 0, y: 0 },
    };
    const windowState = {
      position: { x: 1_052, y: 600 },
      size: { width: 116, height: 125 },
      locked: false,
    };
    const controller = new InteractionSurfaceController(
      root,
      {
        setViewport(width, height, origin) {
          viewport.width = width;
          viewport.height = height;
          viewport.origin = { ...origin };
        },
      },
      {
        async resize(width, height) {
          windowState.size = { width, height };
        },
        async move(x, y) {
          windowState.position = { x, y };
        },
        async lockInteraction(locked) {
          windowState.locked = locked;
        },
      },
    );
    const context = {
      position: { x: 1_052, y: 600 },
      windowSize: { width: 116, height: 125 },
      workArea: { x: 0, y: 0, width: 1_200, height: 800 },
    };

    await controller.open(context);

    expect(windowState).toEqual({
      position: { x: 924, y: 600 },
      size: { width: 276, height: 159 },
      locked: true,
    });
    expect(viewport).toEqual({
      width: 276,
      height: 159,
      origin: { x: 0, y: 0 },
    });
    expect(root.dataset.side).toBe("right");
    expect(root.style.getPropertyValue("--pet-origin-x")).toBe("0px");

    await controller.close(context);

    expect(windowState).toEqual({
      position: { x: 1_052, y: 600 },
      size: { width: 116, height: 125 },
      locked: false,
    });
    expect(viewport).toEqual({
      width: 116,
      height: 125,
      origin: { x: 0, y: 0 },
    });
  });
});
