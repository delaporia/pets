import { describe, expect, it, vi } from "vitest";

import type { StageEntity } from "../src/app/stage/entity";
import { installStagePetInteractions } from "../src/app/interactions/stage-pet-interaction";

function pointerEvent(
  type: string,
  init: MouseEventInit & { pointerId: number },
): PointerEvent {
  const event = new MouseEvent(type, init);
  Object.defineProperty(event, "pointerId", {
    value: init.pointerId,
  });
  return event as PointerEvent;
}

function actor(): StageEntity {
  return {
    id: "ying",
    kind: "pet",
    layer: 20,
    transient: false,
    visible: true,
    visual: "pet-sprite",
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

describe("stage pet interactions", () => {
  it("opens the interaction wheel on secondary-button input", () => {
    const canvas = document.createElement("canvas");
    const openMenu = vi.fn();
    const remove = installStagePetInteractions(canvas, actor(), {
      interrupt: vi.fn(),
      lockInteraction: vi.fn(async () => undefined),
      openMenu,
      invalidate: vi.fn(),
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 1,
        button: 2,
        bubbles: true,
      }),
    );

    expect(openMenu).toHaveBeenCalledOnce();
    remove();
  });

  it("lets primary user input interrupt an autonomous scene before responding", () => {
    vi.useFakeTimers();
    const canvas = document.createElement("canvas");
    const pet = actor();
    const interrupt = vi.fn();
    const remove = installStagePetInteractions(canvas, pet, {
      interrupt,
      lockInteraction: vi.fn(async () => undefined),
      openMenu: vi.fn(),
      invalidate: vi.fn(),
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 4,
        button: 0,
        clientX: 12,
        clientY: 12,
        screenX: 312,
        screenY: 712,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 4,
        button: 0,
        bubbles: true,
      }),
    );

    expect(interrupt).toHaveBeenCalledWith("pointer");
    expect(pet.animation?.clip).toBe("pet");

    remove();
    vi.useRealTimers();
  });

  it("uses the first primary click to close an open wheel without petting or dragging", async () => {
    const canvas = document.createElement("canvas");
    const pet = actor();
    const closeMenu = vi.fn();
    const interrupt = vi.fn();
    const lockInteraction = vi.fn(async () => undefined);
    const remove = installStagePetInteractions(canvas, pet, {
      interrupt,
      lockInteraction,
      openMenu: vi.fn(),
      isMenuOpen: () => true,
      closeMenu,
      invalidate: vi.fn(),
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 11,
        button: 0,
        clientX: 12,
        clientY: 12,
        screenX: 312,
        screenY: 712,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 11,
        button: 0,
        bubbles: true,
      }),
    );
    await Promise.resolve();

    expect(closeMenu).toHaveBeenCalledOnce();
    expect(interrupt).not.toHaveBeenCalled();
    expect(lockInteraction).not.toHaveBeenCalled();
    expect(pet.animation?.clip).toBe("idle");
    remove();
  });

  it("routes a direct pet click through the shared interaction when provided", async () => {
    const canvas = document.createElement("canvas");
    const pet = actor();
    const onClick = vi.fn(async () => true);
    const remove = installStagePetInteractions(canvas, pet, {
      interrupt: vi.fn(),
      lockInteraction: vi.fn(async () => undefined),
      openMenu: vi.fn(),
      onClick,
      invalidate: vi.fn(),
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 12,
        button: 0,
        clientX: 12,
        clientY: 12,
        screenX: 312,
        screenY: 712,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 12,
        button: 0,
        bubbles: true,
      }),
    );
    await Promise.resolve();

    expect(onClick).toHaveBeenCalledOnce();
    expect(pet.animation?.clip).toBe("idle");
    remove();
  });

  it("routes body-zone gestures before menu closing or drag handling", async () => {
    const canvas = document.createElement("canvas");
    const pet = actor();
    const closeMenu = vi.fn();
    const onResult = vi.fn();
    const remove = installStagePetInteractions(canvas, pet, {
      interrupt: vi.fn(),
      lockInteraction: vi.fn(async () => undefined),
      openMenu: vi.fn(),
      isMenuOpen: () => true,
      closeMenu,
      bodyInteraction: {
        active: () => true,
        normalize: (point) => ({
          x: point.x / 100,
          y: point.y / 100,
        }),
        onResult,
      },
      invalidate: vi.fn(),
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 13,
        button: 0,
        clientX: 50,
        clientY: 20,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 13,
        button: 0,
        clientX: 50,
        clientY: 20,
        bubbles: true,
      }),
    );
    await Promise.resolve();

    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        zone: "head",
        gesture: "tap",
      }),
    );
    expect(closeMenu).not.toHaveBeenCalled();
    remove();
  });

  it("interrupts the scene and moves the foot anchor during drag", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("canvas");
    const ying = actor();
    const interrupt = vi.fn();
    const lockInteraction = vi.fn(async () => undefined);
    const invalidate = vi.fn();
    const positionChanged = vi.fn();
    const remove = installStagePetInteractions(canvas, ying, {
      interrupt,
      lockInteraction,
      openMenu: vi.fn(),
      invalidate,
      positionChanged,
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 2,
        button: 0,
        clientX: 20,
        clientY: 30,
        screenX: 320,
        screenY: 650,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointermove", {
        pointerId: 2,
        clientX: 30,
        clientY: 30,
        screenX: 420,
        screenY: 600,
        bubbles: true,
      }),
    );

    expect(interrupt).toHaveBeenCalledWith("drag");
    expect(ying.transform.position).toEqual({ x: 400, y: 650 });
    expect(positionChanged).toHaveBeenLastCalledWith({
      x: 400,
      y: 650,
    });
    expect(ying.animation).toEqual({
      clip: "pickedUp",
      loop: true,
      elapsedMs: 0,
    });
    expect(invalidate).toHaveBeenCalled();

    window.dispatchEvent(
      pointerEvent("pointerup", {
        pointerId: 2,
        button: 0,
        bubbles: true,
      }),
    );
    await Promise.resolve();
    expect(lockInteraction).toHaveBeenLastCalledWith(false);
    expect(ying.animation?.clip).toBe("land");
    vi.advanceTimersByTime(800);
    expect(ying.animation).toEqual({
      clip: "idle",
      loop: true,
      elapsedMs: 0,
    });
    remove();
    vi.useRealTimers();
  });

  it("lands and unlocks when pointer capture is unexpectedly lost", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("canvas");
    const pet = actor();
    const lockInteraction = vi.fn(async () => undefined);
    const remove = installStagePetInteractions(canvas, pet, {
      interrupt: vi.fn(),
      lockInteraction,
      openMenu: vi.fn(),
      invalidate: vi.fn(),
    });

    canvas.dispatchEvent(
      pointerEvent("pointerdown", {
        pointerId: 9,
        button: 0,
        clientX: 10,
        clientY: 10,
        screenX: 310,
        screenY: 710,
        bubbles: true,
      }),
    );
    window.dispatchEvent(
      pointerEvent("pointermove", {
        pointerId: 9,
        clientX: 30,
        clientY: 10,
        screenX: 350,
        screenY: 710,
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(
      pointerEvent("lostpointercapture", {
        pointerId: 9,
        bubbles: true,
      }),
    );
    await Promise.resolve();

    expect(pet.animation?.clip).toBe("land");
    expect(lockInteraction).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(800);
    expect(pet.animation?.clip).toBe("idle");

    remove();
    vi.useRealTimers();
  });
});
