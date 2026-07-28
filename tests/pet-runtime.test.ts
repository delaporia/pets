import { describe, expect, it, vi } from "vitest";

import { PetRuntime } from "../src/app/runtime/pet-runtime";
import type { PetContext } from "../src/app/runtime/pet-context";
import { defaultPetCareState } from "../src/app/care/care-state";
import type { RenderFrame } from "../src/app/animation/animation-player";
import { CooldownLedger } from "../src/app/behaviors/cooldown-ledger";
import { defaultBehaviorProfile } from "../src/app/pets/schemas";

function fixture() {
  const context: PetContext = {
    position: { x: 10, y: 20 },
    workArea: { x: 0, y: 0, width: 500, height: 400 },
    windowSize: { width: 100, height: 120 },
    velocity: { x: 0, y: 0 },
    activityAnchor: null,
    roamingHalfWidth: 200,
    behaviorProfile: defaultBehaviorProfile,
    careState: defaultPetCareState(0),
    elapsedMs: 0,
    cooldowns: new CooldownLedger(),
    personalityMode: "balanced",
    paused: false,
    drag: {
      active: false,
      pointer: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
    },
    animations: {
      play: vi.fn(),
      hasCapability: () => true,
      durationMs: () => 750,
    },
    random: () => 0,
  };
  const frame: RenderFrame = {
    animationId: "idle",
    image: {} as HTMLImageElement,
    row: 0,
    column: 0,
    cellWidth: 192,
    cellHeight: 208,
  };
  const machine = { update: vi.fn(), request: vi.fn(() => true) };
  const player = { update: vi.fn(() => frame) };
  const imageData = {
    data: new Uint8ClampedArray([0, 0, 0, 255]),
    width: 1,
    height: 1,
  } as ImageData;
  const renderer = { draw: vi.fn(() => imageData) };
  const native = {
    move: vi.fn(async () => undefined),
    updateHitMask: vi.fn(async () => undefined),
    setVisible: vi.fn(async () => undefined),
  };
  const cursor = { update: vi.fn(async () => false) };
  return { context, frame, machine, player, renderer, native, cursor };
}

describe("PetRuntime", () => {
  it("keeps scheduling frames after a transient runtime failure", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const f = fixture();
    f.native.updateHitMask.mockRejectedValueOnce(
      new Error("temporary native failure"),
    );
    const runtime = new PetRuntime(f);

    runtime.start();
    callbacks.shift()?.(0);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(callbacks).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Pet runtime frame failed",
      expect.any(Error),
    );

    runtime.stop();
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it("caps a long update delta at 100 milliseconds", async () => {
    const f = fixture();
    const runtime = new PetRuntime(f);

    await runtime.update(1_000);

    expect(f.machine.update).toHaveBeenCalledWith(100);
    expect(f.player.update).toHaveBeenCalledWith(100);
  });

  it("renders and sends a mask only when the animation frame changes", async () => {
    const f = fixture();
    const runtime = new PetRuntime(f);

    await runtime.update(16);
    await runtime.update(16);

    expect(f.renderer.draw).toHaveBeenCalledTimes(1);
    expect(f.native.updateHitMask).toHaveBeenCalledTimes(1);
  });

  it("redraws the current frame after the interaction viewport changes", async () => {
    const f = fixture();
    const runtime = new PetRuntime(f);

    await runtime.update(16);
    runtime.invalidateRender();
    await runtime.update(0);

    expect(f.renderer.draw).toHaveBeenCalledTimes(2);
    expect(f.native.updateHitMask).toHaveBeenCalledTimes(2);
  });

  it("moves the native window only when position changes", async () => {
    const f = fixture();
    const runtime = new PetRuntime(f);
    await runtime.update(16);
    await runtime.update(16);
    f.context.position.x = 25;

    await runtime.update(16);

    expect(f.native.move).toHaveBeenCalledTimes(2);
    expect(f.native.move).toHaveBeenLastCalledWith(25, 20);
  });

  it("pauses autonomous behavior and requests idle", () => {
    const f = fixture();
    const runtime = new PetRuntime(f);

    runtime.setPaused(true);

    expect(f.context.paused).toBe(true);
    expect(f.machine.request).toHaveBeenCalledWith("idle");
  });

  it("clamps position when the work area changes", () => {
    const f = fixture();
    f.context.position = { x: 450, y: 350 };
    const runtime = new PetRuntime(f);

    runtime.setWorkArea({ x: 0, y: 0, width: 300, height: 250 });

    expect(f.context.position).toEqual({ x: 200, y: 130 });
  });

  it("clamps the activity anchor when the work area changes", () => {
    const f = fixture();
    f.context.activityAnchor = { x: 450, y: 350 };
    const runtime = new PetRuntime(f);

    runtime.setWorkArea({ x: 0, y: 0, width: 300, height: 250 });

    expect(f.context.activityAnchor).toEqual({ x: 200, y: 130 });
    expect(f.context.position.y).toBe(130);
  });

  it("applies personality changes immediately", () => {
    const f = fixture();
    const runtime = new PetRuntime(f);

    runtime.setPersonality("lively");

    expect(f.context.personalityMode).toBe("lively");
  });

  it("updates cursor proximity with current runtime state", async () => {
    const f = fixture();
    f.context.drag.active = true;
    const runtime = new PetRuntime(f);

    await runtime.update(250);

    expect(f.cursor.update).toHaveBeenCalledWith({
      nowMs: 100,
      position: { x: 10, y: 20 },
      windowSize: { width: 100, height: 120 },
      visualBounds: undefined,
      dragging: true,
      interactionActive: undefined,
      activeBehaviorId: undefined,
      personalityMode: "balanced",
    });
  });

  it("runs the action showcase instead of autonomous behavior in test mode", async () => {
    const f = fixture();
    const showcase = {
      start: vi.fn(),
      stop: vi.fn(),
      update: vi.fn(),
    };
    f.context.personalityMode = "test";
    const runtime = new PetRuntime({ ...f, showcase });

    await runtime.update(16);

    expect(showcase.start).toHaveBeenCalledOnce();
    expect(showcase.update).toHaveBeenCalledWith(16);
    expect(f.machine.update).not.toHaveBeenCalled();
  });
});
