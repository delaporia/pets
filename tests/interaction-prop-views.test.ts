import { beforeAll, describe, expect, it } from "vitest";
import type { SnapshotView } from "../src/app/stage/pixi-display-adapter";

const transform = {
  position: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotation: 0,
  alpha: 1,
};

describe("interaction prop views", () => {
  let createDefaultPixiView: (
    snapshot: Parameters<
      typeof import("../src/app/stage/pixi-display-adapter").createDefaultPixiView
    >[0],
  ) => SnapshotView;

  beforeAll(async () => {
    Object.defineProperty(
      HTMLCanvasElement.prototype,
      "getContext",
      {
        configurable: true,
        value: () => ({
          fillStyle: "",
          globalCompositeOperation: "source-over",
          fillRect() {},
          getImageData: () => ({
            data: new Uint8ClampedArray(4),
          }),
        }),
      },
    );
    ({ createDefaultPixiView } = await import(
      "../src/app/stage/pixi-display-adapter"
    ));
  });

  it.each([
    "kibble-bowl",
    "wet-food-can",
    "toy-ball",
    "toy-wand",
  ])("draws a visible %s view", (visual) => {
    const view = createDefaultPixiView({
      id: visual,
      kind: "prop",
      visual,
      visible: true,
      transform,
    });

    expect(view.children.length).toBeGreaterThan(0);
  });
});
