import { describe, expect, it, vi } from "vitest";

import { StageRuntime } from "../src/app/runtime/stage-runtime";
import { SceneDirector } from "../src/app/scenes/scene-director";
import type { SceneEntityDeclaration } from "../src/app/scenes/timeline";
import { createPetChasesButterflyScene } from "../src/app/scenes/pet-chases-butterfly";
import type { StageEntity } from "../src/app/stage/entity";
import { EntityRegistry } from "../src/app/stage/entity-registry";
import { WorldCoordinateSystem } from "../src/app/stage/world-coordinate-system";

function entityFrom(
  declaration: SceneEntityDeclaration,
): StageEntity {
  return {
    id: declaration.id,
    kind: declaration.kind,
    layer: declaration.layer,
    transient: true,
    visible: true,
    visual: declaration.visual,
    localBounds: declaration.localBounds,
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

function percentile95(samples: readonly number[]): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? 0;
}

describe("realtime stage performance boundary", () => {
  it("renders the complete ten-second scene within budget and releases transients", async () => {
    const registry = new EntityRegistry();
    registry.add({
      id: "ying",
      kind: "pet",
      layer: 20,
      transient: false,
      visible: true,
      visual: "pet-sprite",
      localBounds: {
        x: -70,
        y: -140,
        width: 140,
        height: 140,
      },
      transform: {
        position: { x: 400, y: 720 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        alpha: 1,
      },
      animation: {
        clip: "idle",
        loop: true,
        elapsedMs: 0,
      },
    });
    const director = new SceneDirector(registry, entityFrom);
    const stage = {
      setViewport: vi.fn(),
      sync: vi.fn(),
      render: vi.fn(),
      readAlphaMask: vi.fn(() => ({
        width: 1,
        height: 1,
        threshold: 128,
        pixels: [255],
      })),
      destroy: vi.fn(),
    };
    const runtime = new StageRuntime({
      registry,
      director,
      stage,
      native: {
        resizeAndMove: vi.fn(async () => undefined),
        updateHitMask: vi.fn(async () => undefined),
        setVisible: vi.fn(async () => undefined),
      },
      coordinates: new WorldCoordinateSystem({
        x: 0,
        y: 0,
        width: 1_440,
        height: 900,
      }),
      boundsPadding: 28,
    });
    const completion = director.play(
      createPetChasesButterflyScene({
        origin: { x: 400, y: 720 },
        direction: "right",
        distance: "mid",
        pathVariant: 1,
        endingVariant: "escape",
      }),
    );
    const frameDurations: number[] = [];

    for (let elapsed = 0; elapsed < 10_000; elapsed += 16.67) {
      const startedAt = performance.now();
      await runtime.update(16.67);
      frameDurations.push(performance.now() - startedAt);
    }

    await expect(completion).resolves.toMatchObject({
      status: "completed",
    });
    expect(
      registry.ordered().filter((entity) => entity.transient),
    ).toEqual([]);
    expect(stage.render).toHaveBeenCalledTimes(frameDurations.length);
    expect(percentile95(frameDurations)).toBeLessThanOrEqual(16.7);
  });
});
