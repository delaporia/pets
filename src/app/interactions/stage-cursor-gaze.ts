import type { StageEntity } from "../stage/entity";
import type { Point } from "../stage/geometry";

interface CursorPositionSource {
  cursorPosition(): Promise<Point>;
}

const directionIndex = (dx: number, dy: number): number => {
  const clockwiseFromUp = Math.atan2(dx, -dy);
  const normalized =
    (clockwiseFromUp + Math.PI * 2) % (Math.PI * 2);
  return Math.round(normalized / (Math.PI / 8)) % 16;
};

export class StageCursorGazeController {
  private lastPollMs: number | undefined;

  constructor(
    private readonly actor: StageEntity,
    private readonly source: CursorPositionSource,
    private readonly isActive: () => boolean,
    private readonly pollIntervalMs = 16,
  ) {}

  async update(nowMs: number): Promise<void> {
    if (!this.isActive()) {
      this.clear();
      this.lastPollMs = undefined;
      return;
    }
    if (
      this.lastPollMs !== undefined &&
      nowMs - this.lastPollMs < this.pollIntervalMs
    ) {
      return;
    }
    this.lastPollMs = nowMs;
    try {
      const cursor = await this.source.cursorPosition();
      if (this.isInsideBody(cursor)) {
        this.clear();
        return;
      }
      const look = this.actor.anchors?.look ?? { x: 0, y: -80 };
      const origin = {
        x: this.actor.transform.position.x + look.x,
        y: this.actor.transform.position.y + look.y,
      };
      this.actor.gazeDirectionIndex = directionIndex(
        cursor.x - origin.x,
        cursor.y - origin.y,
      );
    } catch {
      this.clear();
    }
  }

  clear(): void {
    this.actor.gazeDirectionIndex = undefined;
  }

  private isInsideBody(cursor: Point): boolean {
    const bounds = this.actor.localBounds;
    if (!bounds) return false;
    const scaleX = Math.abs(this.actor.transform.scale.x);
    const scaleY = Math.abs(this.actor.transform.scale.y);
    const left =
      this.actor.transform.position.x + bounds.x * scaleX;
    const top =
      this.actor.transform.position.y + bounds.y * scaleY;
    return (
      cursor.x >= left &&
      cursor.x <= left + bounds.width * scaleX &&
      cursor.y >= top &&
      cursor.y <= top + bounds.height * scaleY
    );
  }
}
