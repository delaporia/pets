import type { Point } from "../runtime/pet-context";

export type BodyZone = "head" | "chin" | "belly" | "tail";

export type BodyGesture = "tap" | "stroke" | "scratch" | "rub" | "tease";

export interface BodyInteractionResult {
  zone: BodyZone;
  gesture: BodyGesture;
  intensity: "gentle" | "excited";
  durationMs: number;
}

function inside(
  point: Point,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  return (
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom
  );
}

export function identifyYingBodyZone(point: Point): BodyZone | null {
  if (inside(point, 0.72, 0.48, 1, 0.9)) return "tail";
  if (inside(point, 0.32, 0.25, 0.7, 0.44)) return "chin";
  if (inside(point, 0.18, 0.04, 0.82, 0.38)) return "head";
  if (inside(point, 0.18, 0.38, 0.82, 0.88)) return "belly";
  return null;
}

export class BodyInteractionTracker {
  private startPoint: Point | undefined;
  private previousPoint: Point | undefined;
  private startedAtMs = 0;
  private distance = 0;
  private zone: BodyZone | null = null;

  constructor(
    private readonly identifyZone: (point: Point) => BodyZone | null,
  ) {}

  start(point: Point, timestampMs: number): void {
    this.startPoint = { ...point };
    this.previousPoint = { ...point };
    this.startedAtMs = timestampMs;
    this.distance = 0;
    this.zone = this.identifyZone(point);
  }

  move(point: Point, _timestampMs: number): void {
    if (!this.previousPoint) return;
    this.distance += Math.hypot(
      point.x - this.previousPoint.x,
      point.y - this.previousPoint.y,
    );
    this.previousPoint = { ...point };
  }

  finish(
    point: Point,
    timestampMs: number,
  ): BodyInteractionResult | null {
    if (!this.startPoint || !this.previousPoint || !this.zone) {
      this.reset();
      return null;
    }
    const finalZone = this.identifyZone(point);
    if (finalZone !== this.zone) {
      this.reset();
      return null;
    }
    this.move(point, timestampMs);
    const zone = this.zone;
    const durationMs = Math.max(0, timestampMs - this.startedAtMs);
    const speed = this.distance / Math.max(1, durationMs);
    const intensity =
      speed > 0.00075 || (durationMs < 250 && this.distance > 0.08)
        ? "excited"
        : "gentle";
    const gesture: BodyGesture =
      zone === "tail"
        ? this.distance > 0.06
          ? "tease"
          : "tap"
        : zone === "chin"
          ? "scratch"
          : zone === "belly"
            ? "rub"
            : this.distance > 0.04
              ? "stroke"
              : "tap";
    this.reset();
    return { zone, gesture, intensity, durationMs };
  }

  cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.startPoint = undefined;
    this.previousPoint = undefined;
    this.startedAtMs = 0;
    this.distance = 0;
    this.zone = null;
  }
}
