import type { Point } from "../runtime/pet-context";

export type PointerMoveResult =
  | "ignored"
  | "pending"
  | "drag-start"
  | "dragging";
export type PointerEndResult =
  | "ignored"
  | "click"
  | "drag-end"
  | "cancelled";
export type PointerDownResult = "ignored" | "pending" | "context-menu";

export interface PointerDownOptions {
  button: number;
  scaleFactor: number;
}

export class PointerGestureTracker {
  private pointerId: number | undefined;
  private start: Point | undefined;
  private dragging = false;
  private thresholdScale = 1;

  constructor(private readonly dragThreshold: number) {}

  get activePointerId(): number | undefined {
    return this.pointerId;
  }

  down(
    pointerId: number,
    point: Point,
    options: PointerDownOptions = { button: 0, scaleFactor: 1 },
  ): PointerDownResult {
    if (this.pointerId !== undefined) {
      return "ignored";
    }
    if (options.button === 2) {
      this.reset();
      return "context-menu";
    }
    if (options.button !== 0) {
      this.reset();
      return "ignored";
    }
    this.pointerId = pointerId;
    this.start = point;
    this.dragging = false;
    this.thresholdScale = Math.max(1, options.scaleFactor);
    return "pending";
  }

  move(pointerId: number, point: Point): PointerMoveResult {
    if (pointerId !== this.pointerId || !this.start) return "ignored";
    if (this.dragging) return "dragging";
    const dx = point.x - this.start.x;
    const dy = point.y - this.start.y;
    const threshold = this.dragThreshold * this.thresholdScale;
    if (dx * dx + dy * dy <= threshold * threshold) {
      return "pending";
    }
    this.dragging = true;
    return "drag-start";
  }

  end(pointerId: number): PointerEndResult {
    if (pointerId !== this.pointerId) return "ignored";
    const result = this.dragging ? "drag-end" : "click";
    this.reset();
    return result;
  }

  cancel(pointerId: number): PointerEndResult {
    if (pointerId !== this.pointerId) return "ignored";
    this.reset();
    return "cancelled";
  }

  private reset(): void {
    this.pointerId = undefined;
    this.start = undefined;
    this.dragging = false;
    this.thresholdScale = 1;
  }
}
