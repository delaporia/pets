import { describe, expect, it, vi } from "vitest";

import {
  createInitialContext,
  installInteractionHandlers,
} from "../src/app/bootstrap/app";
import type { LoadedPet } from "../src/app/pets/pet-loader";
import { parsePetManifest } from "../src/app/pets/schemas";

function pointerEvent(
  type: string,
  init: MouseEventInit & { pointerId: number },
): PointerEvent {
  const event = new MouseEvent(type, init);
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  return event as PointerEvent;
}

function pet(): LoadedPet {
  return {
    manifest: parsePetManifest({
      schemaVersion: 1,
      id: "pet",
      displayName: "Pet",
      description: "",
      spriteVersionNumber: 2,
      display: { scale: 0.5 },
      atlases: {
        main: {
          path: "sheet.webp",
          cellWidth: 192,
          cellHeight: 208,
          columns: 1,
          rows: 3,
        },
      },
      animations: {
        idle: { atlas: "main", row: 0, frames: [0], fps: 1, loop: true },
        walkRight: {
          atlas: "main",
          row: 1,
          frames: [0],
          fps: 1,
          loop: true,
        },
        walkLeft: {
          atlas: "main",
          row: 2,
          frames: [0],
          fps: 1,
          loop: true,
        },
      },
      capabilities: {
        idle: "idle",
        walkRight: "walkRight",
        walkLeft: "walkLeft",
      },
    }),
    images: new Map([["main", {} as HTMLImageElement]]),
  };
}

describe("desktop pet bootstrap", () => {
  it("places the pet near the primary work-area bottom-right", () => {
    const context = createInitialContext(
      pet(),
      { x: 0, y: 0, width: 500, height: 400 },
      { play: vi.fn(), hasCapability: () => true, durationMs: () => 750 },
    );

    expect(context.windowSize).toEqual({ width: 96, height: 104 });
    expect(context.position).toEqual({ x: 372, y: 296 });
    expect(context.activityAnchor).toBeNull();
    expect(context.roamingHalfWidth).toBe(200);
  });

  it("distinguishes clicks from drags and locks native interaction", async () => {
    const canvas = document.createElement("canvas");
    const context = createInitialContext(
      pet(),
      { x: 0, y: 0, width: 500, height: 400 },
      { play: vi.fn(), hasCapability: () => true, durationMs: () => 750 },
    );
    const machine = { request: vi.fn(() => true) };
    const native = { lockInteraction: vi.fn(async () => undefined) };
    const remove = installInteractionHandlers(canvas, context, machine, native);

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 1,
        clientX: 10,
        clientY: 20,
        screenX: 200,
        screenY: 300,
        bubbles: true,
      }),
    );
    await Promise.resolve();

    expect(context.drag.active).toBe(false);
    expect(context.drag.offset).toEqual({ x: 10, y: 20 });
    expect(context.drag.pointer).toEqual({ x: 200, y: 300 });
    expect(machine.request).not.toHaveBeenCalledWith("drag-and-drop");
    expect(native.lockInteraction).toHaveBeenCalledWith(true);

    window.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 1, bubbles: true }),
    );
    await Promise.resolve();
    expect(context.drag.active).toBe(false);
    expect(native.lockInteraction).toHaveBeenLastCalledWith(false);

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 2,
        clientX: 10,
        clientY: 20,
        screenX: 200,
        screenY: 300,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointermove", {
        pointerId: 2,
        clientX: 18,
        clientY: 20,
        screenX: 208,
        screenY: 300,
        bubbles: true,
      }),
    );

    expect(context.drag.active).toBe(true);
    expect(machine.request).toHaveBeenCalledWith("drag-and-drop", {
      restart: true,
      source: "user",
    });

    window.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 2, bubbles: true }),
    );
    await Promise.resolve();
    expect(context.drag.active).toBe(false);
    expect(machine.request).toHaveBeenCalledWith("landing", {
      restart: true,
      source: "user",
    });

    remove();
  });

  it("keeps secondary-button input out of click and drag handling", async () => {
    const canvas = document.createElement("canvas");
    const context = createInitialContext(
      pet(),
      { x: 0, y: 0, width: 500, height: 400 },
      { play: vi.fn(), hasCapability: () => true, durationMs: () => 750 },
    );
    const machine = { request: vi.fn(() => true) };
    const native = { lockInteraction: vi.fn(async () => undefined) };
    const showContextMenu = vi.fn();
    const remove = installInteractionHandlers(
      canvas,
      context,
      machine,
      native,
      showContextMenu,
    );

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 9,
        button: 2,
        clientX: 10,
        clientY: 20,
        screenX: 200,
        screenY: 300,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 9,
        button: 2,
        bubbles: true,
      }),
    );
    await Promise.resolve();

    expect(native.lockInteraction).not.toHaveBeenCalled();
    expect(machine.request).not.toHaveBeenCalled();
    expect(showContextMenu).toHaveBeenCalledOnce();
    remove();
  });

  it("routes pointer paths to body interaction while direct touch mode is active", async () => {
    const canvas = document.createElement("canvas");
    const context = createInitialContext(
      pet(),
      { x: 0, y: 0, width: 500, height: 400 },
      { play: vi.fn(), hasCapability: () => true, durationMs: () => 750 },
    );
    const machine = { request: vi.fn(() => true) };
    const native = { lockInteraction: vi.fn(async () => undefined) };
    const onResult = vi.fn();
    const remove = installInteractionHandlers(
      canvas,
      context,
      machine,
      native,
      undefined,
      {
        active: () => true,
        petOrigin: () => ({ x: 190, y: 0 }),
        onResult,
      },
    );

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 15,
        clientX: 235,
        clientY: 20,
        screenX: 500,
        screenY: 500,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointermove", {
        pointerId: 15,
        clientX: 245,
        clientY: 23,
        screenX: 510,
        screenY: 503,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 15,
        clientX: 255,
        clientY: 25,
        screenX: 520,
        screenY: 505,
        bubbles: true,
      }),
    );

    expect(onResult).toHaveBeenCalledWith({
      zone: "head",
      gesture: "stroke",
      intensity: "excited",
      durationMs: expect.any(Number),
    });
    expect(machine.request).not.toHaveBeenCalledWith("drag-and-drop", {
      restart: true,
      source: "user",
    });
    remove();
  });

  it("serializes native interaction locking across a quick release", async () => {
    const canvas = document.createElement("canvas");
    const context = createInitialContext(
      pet(),
      { x: 0, y: 0, width: 500, height: 400 },
      { play: vi.fn(), hasCapability: () => true, durationMs: () => 750 },
    );
    const machine = { request: vi.fn(() => true) };
    let releaseLock!: () => void;
    const native = {
      lockInteraction: vi.fn(
        (locked: boolean) =>
          locked
            ? new Promise<void>((resolve) => {
                releaseLock = resolve;
              })
            : Promise.resolve(),
      ),
    };
    const remove = installInteractionHandlers(canvas, context, machine, native);

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 10,
        clientX: 10,
        clientY: 20,
        screenX: 200,
        screenY: 300,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 10, bubbles: true }),
    );
    await Promise.resolve();

    expect(native.lockInteraction.mock.calls).toEqual([[true]]);

    releaseLock();
    await Promise.resolve();
    await Promise.resolve();
    expect(native.lockInteraction.mock.calls).toEqual([[true], [false]]);
    remove();
  });

  it("cancels and unlocks when pointer capture is unexpectedly lost", async () => {
    const canvas = document.createElement("canvas");
    const context = createInitialContext(
      pet(),
      { x: 0, y: 0, width: 500, height: 400 },
      { play: vi.fn(), hasCapability: () => true, durationMs: () => 750 },
    );
    const machine = { request: vi.fn(() => true) };
    const native = { lockInteraction: vi.fn(async () => undefined) };
    const remove = installInteractionHandlers(canvas, context, machine, native);

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 11,
        clientX: 10,
        clientY: 20,
        screenX: 200,
        screenY: 300,
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(
      pointerEvent("lostpointercapture", {
        pointerId: 11,
        bubbles: true,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(native.lockInteraction).toHaveBeenLastCalledWith(false);
    expect(machine.request).not.toHaveBeenCalled();
    remove();
  });
});
