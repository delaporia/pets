import type { BehaviorResult, PetBehavior } from "./behavior";
import type { PetContext } from "../runtime/pet-context";
import { personalityProfiles } from "../personality/profiles";

export type WalkDirection = "left" | "right";

export class GroundWalkBehavior implements PetBehavior<PetContext> {
  readonly id: string;
  readonly priority = 10;
  private speed = 45;
  private elapsedMs = 0;
  private durationMs = 0;

  constructor(private readonly direction: WalkDirection) {
    this.id = `walk-${direction}`;
  }

  canEnter(context: PetContext): boolean {
    return !context.paused && !context.interactionActive;
  }

  enter(context: PetContext): void {
    const movement = context.behaviorProfile.movement;
    const personality = personalityProfiles[context.personalityMode];
    this.speed = movement.walkSpeed * personality.walkSpeedMultiplier;
    this.elapsedMs = 0;
    this.durationMs =
      movement.minDurationMs +
      Math.min(1, Math.max(0, context.random())) *
        (movement.maxDurationMs - movement.minDurationMs);
    context.velocity = {
      x: this.direction === "right" ? this.speed : -this.speed,
      y: 0,
    };
    context.animations.play(
      this.direction === "right" ? "walkRight" : "walkLeft",
    );
  }

  update(context: PetContext, deltaMs: number): BehaviorResult {
    if (context.paused || context.interactionActive) {
      return { status: "complete", next: "idle" };
    }
    const safeDeltaMs = Math.max(0, deltaMs);
    this.elapsedMs += safeDeltaMs;
    const workAreaMinX = context.workArea.x;
    const workAreaMaxX =
      context.workArea.x + context.workArea.width - context.windowSize.width;
    const minX = context.activityAnchor
      ? Math.max(
          workAreaMinX,
          context.activityAnchor.x -
            context.behaviorProfile.movement.roamingHalfWidth,
        )
      : workAreaMinX;
    const maxX = context.activityAnchor
      ? Math.min(
          workAreaMaxX,
          context.activityAnchor.x +
            context.behaviorProfile.movement.roamingHalfWidth,
        )
      : workAreaMaxX;
    if (context.activityAnchor) {
      context.position.y = context.activityAnchor.y;
    }
    const nextX =
      context.position.x + context.velocity.x * (safeDeltaMs / 1000);
    context.position.x = Math.min(maxX, Math.max(minX, nextX));

    if (nextX >= maxX && this.direction === "right") {
      return { status: "complete", next: "idle" };
    }
    if (nextX <= minX && this.direction === "left") {
      return { status: "complete", next: "idle" };
    }
    if (this.elapsedMs >= this.durationMs) {
      return { status: "complete", next: "idle" };
    }
    return { status: "running" };
  }

  exit(context: PetContext): void {
    context.velocity.x = 0;
  }
}
