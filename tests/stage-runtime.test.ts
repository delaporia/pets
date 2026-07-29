import { describe, expect, it, vi } from "vitest";

import type { StageEntity } from "../src/app/stage/entity";
import { EntityRegistry } from "../src/app/stage/entity-registry";
import { WorldCoordinateSystem } from "../src/app/stage/world-coordinate-system";
import { StageRuntime } from "../src/app/runtime/stage-runtime";

function pet(): StageEntity {
  return {
    id: "ying",
    kind: "pet",
    layer: 20,
    transient: false,
    visible: true,
    localBounds: {
      x: -50,
      y: -100,
      width: 100,
      height: 100,
    },
    transform: {
      position: { x: 300, y: 700 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
    animation: {
      clip: "idle",
      loop: true,
      elapsedMs: 0,
    },
  };
}

function fixture(
  callbacks: {
    onLayout?: (viewport: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => void;
    onBeforeRender?: (
      elapsedMs: number,
      deltaMs: number,
    ) => void | Promise<void>;
    onPausedChanged?: (paused: boolean) => void;
  } = {},
) {
  const registry = new EntityRegistry();
  const ying = pet();
  registry.add(ying);
  const director = { update: vi.fn() };
  const stage = {
    setViewport: vi.fn(),
    sync: vi.fn(),
    render: vi.fn(),
    readAlphaMask: vi.fn(() => ({
      width: 148,
      height: 148,
      threshold: 128,
      pixels: new Array<number>(148 * 148).fill(0),
    })),
    destroy: vi.fn(),
  };
  const native = {
    resizeAndMove: vi.fn(async () => undefined),
    updateHitMask: vi.fn(async () => undefined),
    setVisible: vi.fn(async () => undefined),
  };
  const coordinates = new WorldCoordinateSystem({
    x: 0,
    y: 0,
    width: 1_440,
    height: 900,
  });
  const runtime = new StageRuntime({
    registry,
    director,
    stage,
    native,
    coordinates,
    boundsPadding: 24,
    hitMaskIntervalMs: 100,
    onLayout: callbacks.onLayout,
    onBeforeRender: callbacks.onBeforeRender,
    onPausedChanged: callbacks.onPausedChanged,
  });
  return {
    registry,
    ying,
    director,
    stage,
    native,
    coordinates,
    runtime,
  };
}

describe("StageRuntime", () => {
  it("fits world content and synchronizes native bounds before rendering", async () => {
    const { runtime, native, stage } = fixture();

    await runtime.update(16);

    expect(native.resizeAndMove).toHaveBeenCalledWith({
      x: 226,
      y: 576,
      width: 148,
      height: 148,
    });
    expect(stage.setViewport).toHaveBeenCalledWith({
      x: 226,
      y: 576,
      width: 148,
      height: 148,
    });
    expect(stage.render).toHaveBeenCalledOnce();
    expect(native.updateHitMask).toHaveBeenCalledOnce();
  });

  it("renders every update while suppressing unchanged bounds and mask work", async () => {
    const { runtime, native, stage } = fixture();

    await runtime.update(16);
    await runtime.update(16);

    expect(stage.render).toHaveBeenCalledTimes(2);
    expect(native.resizeAndMove).toHaveBeenCalledTimes(1);
    expect(native.updateHitMask).toHaveBeenCalledTimes(1);
  });

  it("caps long deltas and recomputes bounds after world movement", async () => {
    const { runtime, ying, director, native } = fixture();
    await runtime.update(16);
    ying.transform.position.x = 500;

    await runtime.update(1_000);

    expect(director.update).toHaveBeenLastCalledWith(100);
    expect(native.resizeAndMove).toHaveBeenLastCalledWith({
      x: 426,
      y: 576,
      width: 148,
      height: 148,
    });
  });

  it("refreshes the alpha mask after invalidation", async () => {
    const { runtime, native } = fixture();
    await runtime.update(16);

    runtime.invalidateHitMask();
    await runtime.update(0);

    expect(native.updateHitMask).toHaveBeenCalledTimes(2);
  });

  it("keeps rendering while autonomous scene time is paused", async () => {
    const { runtime, director, stage } = fixture();
    runtime.setPaused(true);

    await runtime.update(16);

    expect(director.update).not.toHaveBeenCalled();
    expect(stage.render).toHaveBeenCalledOnce();
  });

  it("notifies session controllers when pause state changes", () => {
    const onPausedChanged = vi.fn();
    const { runtime } = fixture({ onPausedChanged });

    runtime.setPaused(true);
    runtime.setPaused(false);

    expect(onPausedChanged.mock.calls).toEqual([[true], [false]]);
  });

  it("advances an actor animation when no scene track owns it", async () => {
    const { runtime, ying } = fixture();

    await runtime.update(80);

    expect(ying.animation?.elapsedMs).toBe(80);
  });

  it("reports layout every frame so DOM interaction UI can follow the actor", async () => {
    const onLayout = vi.fn();
    const { runtime, ying } = fixture({ onLayout });

    await runtime.update(16);
    ying.transform.position.x += 4;
    await runtime.update(16);

    expect(onLayout).toHaveBeenCalledTimes(2);
    expect(onLayout).toHaveBeenLastCalledWith({
      x: 230,
      y: 576,
      width: 148,
      height: 148,
    });
  });

  it("awaits frame controllers before synchronizing the display", async () => {
    const order: string[] = [];
    const onBeforeRender = vi.fn(async (elapsedMs: number) => {
      order.push(`gaze:${elapsedMs}`);
    });
    const { runtime, stage } = fixture({ onBeforeRender });
    stage.sync.mockImplementation(() => order.push("sync"));

    await runtime.update(80);
    await runtime.update(80);

    expect(onBeforeRender).toHaveBeenNthCalledWith(1, 80, 80);
    expect(onBeforeRender).toHaveBeenNthCalledWith(2, 160, 80);
    expect(order).toEqual(["gaze:80", "sync", "gaze:160", "sync"]);
  });

  it("reports the clamped frame delta separately from accumulated time", async () => {
    const onBeforeRender = vi.fn();
    const { runtime } = fixture({ onBeforeRender });

    await runtime.update(40);
    await runtime.update(250);

    expect(onBeforeRender.mock.calls).toEqual([
      [40, 40],
      [140, 100],
    ]);
  });
});
