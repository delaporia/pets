import type { Point, Rect } from "./geometry";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validateRect(rect: Rect, label: string): void {
  if (
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    throw new Error(`${label} must have positive dimensions`);
  }
}

export class WorldCoordinateSystem {
  private currentViewport: Rect;

  constructor(private readonly workArea: Rect) {
    validateRect(workArea, "Work area");
    this.currentViewport = { ...workArea };
  }

  get viewport(): Rect {
    return { ...this.currentViewport };
  }

  fit(contentBounds: Rect, padding: number): Rect {
    validateRect(contentBounds, "Content bounds");
    if (!Number.isFinite(padding) || padding < 0) {
      throw new Error("Stage padding must be non-negative");
    }

    const requestedX = Math.floor(contentBounds.x - padding);
    const requestedY = Math.floor(contentBounds.y - padding);
    const requestedRight = Math.ceil(
      contentBounds.x + contentBounds.width + padding,
    );
    const requestedBottom = Math.ceil(
      contentBounds.y + contentBounds.height + padding,
    );
    const width = Math.min(
      Math.floor(this.workArea.width),
      requestedRight - requestedX,
    );
    const height = Math.min(
      Math.floor(this.workArea.height),
      requestedBottom - requestedY,
    );
    const maximumX = this.workArea.x + this.workArea.width - width;
    const maximumY = this.workArea.y + this.workArea.height - height;

    this.currentViewport = {
      x: clamp(requestedX, this.workArea.x, maximumX),
      y: clamp(requestedY, this.workArea.y, maximumY),
      width,
      height,
    };
    return this.viewport;
  }

  worldToLocal(point: Point): Point {
    return {
      x: point.x - this.currentViewport.x,
      y: point.y - this.currentViewport.y,
    };
  }

  localToWorld(point: Point): Point {
    return {
      x: point.x + this.currentViewport.x,
      y: point.y + this.currentViewport.y,
    };
  }
}
