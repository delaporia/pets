import { describe, expect, it } from "vitest";

import type { StageEntity } from "../src/app/stage/entity";
import {
  PixiStage,
  type PixiStageBackend,
  type StageDisplaySnapshot,
} from "../src/app/stage/pixi-stage";

function entity(
  id: string,
  layer: number,
  x: number,
  y: number,
): StageEntity {
  return {
    id,
    kind: id === "ying" ? "pet" : "prop",
    layer,
    transient: id !== "ying",
    visible: true,
    transform: {
      position: { x, y },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

class RecordingBackend implements PixiStageBackend {
  initialized = false;
  size = { width: 0, height: 0 };
  snapshots: StageDisplaySnapshot[] = [];
  renderCount = 0;
  destroyed = false;
  pixels = new Uint8ClampedArray([
    0, 0, 0, 0,
    255, 220, 40, 200,
  ]);

  async initialize(
    _canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): Promise<void> {
    this.initialized = true;
    this.size = { width, height };
  }

  resize(width: number, height: number): void {
    this.size = { width, height };
  }

  sync(snapshots: readonly StageDisplaySnapshot[]): void {
    this.snapshots = snapshots.map((snapshot) => ({
      ...snapshot,
      transform: {
        ...snapshot.transform,
        position: { ...snapshot.transform.position },
        scale: { ...snapshot.transform.scale },
      },
    }));
  }

  render(): void {
    this.renderCount += 1;
  }

  readPixels(): Uint8ClampedArray {
    return this.pixels;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

describe("PixiStage", () => {
  it("synchronizes entities in draw order using viewport-local positions", async () => {
    const canvas = document.createElement("canvas");
    const backend = new RecordingBackend();
    const stage = await PixiStage.create(canvas, {
      backend,
      width: 320,
      height: 180,
    });

    stage.setViewport({ x: 1_000, y: 600, width: 320, height: 180 });
    stage.sync([
      entity("butterfly", 30, 1_180, 650),
      entity("ying", 20, 1_040, 720),
    ]);

    expect(backend.initialized).toBe(true);
    expect(backend.snapshots.map(({ id }) => id)).toEqual([
      "ying",
      "butterfly",
    ]);
    expect(backend.snapshots.map(({ transform }) => transform.position)).toEqual([
      { x: 40, y: 120 },
      { x: 180, y: 50 },
    ]);
  });

  it("resizes the drawing backend when the viewport changes size", async () => {
    const backend = new RecordingBackend();
    const stage = await PixiStage.create(
      document.createElement("canvas"),
      { backend, width: 100, height: 120 },
    );

    stage.setViewport({ x: 20, y: 30, width: 360, height: 240 });

    expect(backend.size).toEqual({ width: 360, height: 240 });
  });

  it("passes the pet gaze direction to the display backend", async () => {
    const backend = new RecordingBackend();
    const stage = await PixiStage.create(
      document.createElement("canvas"),
      { backend, width: 100, height: 120 },
    );
    const ying = entity("ying", 20, 50, 100);
    ying.gazeDirectionIndex = 13;

    stage.sync([ying]);

    expect(backend.snapshots[0]?.gazeDirectionIndex).toBe(13);
  });

  it("renders on demand and converts rgba pixels to the native alpha mask", async () => {
    const backend = new RecordingBackend();
    const stage = await PixiStage.create(
      document.createElement("canvas"),
      { backend, width: 2, height: 1, alphaThreshold: 128 },
    );

    stage.render();

    expect(backend.renderCount).toBe(1);
    expect(stage.readAlphaMask()).toEqual({
      width: 2,
      height: 1,
      threshold: 128,
      pixels: [0, 255],
    });
  });

  it("destroys its rendering backend exactly once", async () => {
    const backend = new RecordingBackend();
    const stage = await PixiStage.create(
      document.createElement("canvas"),
      { backend, width: 2, height: 1 },
    );

    stage.destroy();
    stage.destroy();

    expect(backend.destroyed).toBe(true);
  });
});
