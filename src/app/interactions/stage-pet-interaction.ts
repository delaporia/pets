import type { StageEntity } from "../stage/entity";
import type { Point } from "../stage/geometry";
import {
  BodyInteractionTracker,
  identifyPetBodyZone,
  type BodyInteractionResult,
} from "./body-interaction";
import { PointerGestureTracker } from "./pointer-gesture";

export interface StagePetInteractionOptions {
  interrupt(reason: string): boolean | void;
  lockInteraction(locked: boolean): Promise<void>;
  openMenu(): void;
  isMenuOpen?(): boolean;
  closeMenu?(): void;
  onClick?(): void | Promise<unknown>;
  bodyInteraction?: {
    active(): boolean;
    normalize(point: Point): Point;
    onResult(result: BodyInteractionResult): void | Promise<void>;
  };
  invalidate(): void;
  positionChanged?(position: Point): void;
}

export function installStagePetInteractions(
  canvas: HTMLCanvasElement,
  actor: StageEntity,
  options: StagePetInteractionOptions,
): () => void {
  const gestures = new PointerGestureTracker(6);
  const bodyGestures = new BodyInteractionTracker(
    identifyPetBodyZone,
  );
  let bodyPointerId: number | undefined;
  let screenOffset = { x: 0, y: 0 };
  let settleTimer: number | undefined;
  let dragging = false;

  const clearSettleTimer = (): void => {
    if (settleTimer === undefined) return;
    window.clearTimeout(settleTimer);
    settleTimer = undefined;
  };

  const returnToIdleAfter = (clip: string, delayMs: number): void => {
    clearSettleTimer();
    settleTimer = window.setTimeout(() => {
      settleTimer = undefined;
      if (actor.animation?.clip !== clip) return;
      actor.animation = {
        clip: "idle",
        loop: true,
        elapsedMs: 0,
      };
      options.invalidate();
    }, delayMs);
  };

  const pointerDown = (event: PointerEvent): void => {
    clearSettleTimer();
    if (
      event.button === 0 &&
      options.bodyInteraction?.active()
    ) {
      bodyPointerId = event.pointerId;
      bodyGestures.start(
        options.bodyInteraction.normalize({
          x: event.clientX,
          y: event.clientY,
        }),
        event.timeStamp,
      );
      options.interrupt("body-interaction");
      void options.lockInteraction(true);
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    if (
      event.button === 0 &&
      options.isMenuOpen?.()
    ) {
      event.preventDefault();
      options.closeMenu?.();
      return;
    }
    const result = gestures.down(
      event.pointerId,
      { x: event.clientX, y: event.clientY },
      { button: event.button, scaleFactor: 1 },
    );
    if (result === "context-menu") {
      event.preventDefault();
      options.openMenu();
      return;
    }
    if (result !== "pending") return;
    options.interrupt("pointer");
    screenOffset = {
      x: event.screenX - actor.transform.position.x,
      y: event.screenY - actor.transform.position.y,
    };
    void options.lockInteraction(true);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const pointerMove = (event: PointerEvent): void => {
    if (event.pointerId === bodyPointerId) {
      bodyGestures.move(
        options.bodyInteraction!.normalize({
          x: event.clientX,
          y: event.clientY,
        }),
        event.timeStamp,
      );
      event.preventDefault();
      return;
    }
    const result = gestures.move(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (result === "ignored" || result === "pending") return;
    if (result === "drag-start") {
      dragging = true;
      options.interrupt("drag");
      actor.animation = {
        clip: "pickedUp",
        loop: true,
        elapsedMs: 0,
      };
    }
    actor.transform.position = {
      x: event.screenX - screenOffset.x,
      y: event.screenY - screenOffset.y,
    };
    options.positionChanged?.({ ...actor.transform.position });
    options.invalidate();
  };

  const pointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === bodyPointerId) {
      bodyPointerId = undefined;
      const result = bodyGestures.finish(
        options.bodyInteraction!.normalize({
          x: event.clientX,
          y: event.clientY,
        }),
        event.timeStamp,
      );
      canvas.releasePointerCapture?.(event.pointerId);
      void options.lockInteraction(false);
      if (result) {
        void options.bodyInteraction!.onResult(result);
      }
      return;
    }
    const result = gestures.end(event.pointerId);
    if (result === "ignored") return;
    if (result === "drag-end") {
      dragging = false;
      actor.animation = {
        clip: "land",
        loop: false,
        elapsedMs: 0,
      };
      options.invalidate();
      returnToIdleAfter("land", 700);
    } else if (result === "click") {
      if (options.onClick) {
        void options.onClick();
        canvas.releasePointerCapture?.(event.pointerId);
        void options.lockInteraction(false);
        return;
      }
      actor.animation = {
        clip: "pet",
        loop: false,
        elapsedMs: 0,
      };
      options.invalidate();
      returnToIdleAfter("pet", 1_800);
    }
    canvas.releasePointerCapture?.(event.pointerId);
    void options.lockInteraction(false);
  };

  const pointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === bodyPointerId) {
      bodyPointerId = undefined;
      bodyGestures.cancel();
      canvas.releasePointerCapture?.(event.pointerId);
      void options.lockInteraction(false);
      return;
    }
    const wasDragging = dragging;
    const result = gestures.cancel(event.pointerId);
    if (result === "ignored") return;
    dragging = false;
    if (wasDragging) {
      actor.animation = {
        clip: "land",
        loop: false,
        elapsedMs: 0,
      };
      options.invalidate();
      returnToIdleAfter("land", 700);
    }
    canvas.releasePointerCapture?.(event.pointerId);
    void options.lockInteraction(false);
  };

  const blur = (): void => {
    if (bodyPointerId !== undefined) {
      pointerCancel({ pointerId: bodyPointerId } as PointerEvent);
    }
    const pointerId = gestures.activePointerId;
    if (pointerId !== undefined) {
      pointerCancel({ pointerId } as PointerEvent);
    }
  };
  const preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("lostpointercapture", pointerCancel);
  canvas.addEventListener("contextmenu", preventContextMenu);
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerEnd);
  window.addEventListener("pointercancel", pointerCancel);
  window.addEventListener("blur", blur);

  return () => {
    clearSettleTimer();
    blur();
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("lostpointercapture", pointerCancel);
    canvas.removeEventListener("contextmenu", preventContextMenu);
    window.removeEventListener("pointermove", pointerMove);
    window.removeEventListener("pointerup", pointerEnd);
    window.removeEventListener("pointercancel", pointerCancel);
    window.removeEventListener("blur", blur);
  };
}
