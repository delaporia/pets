import type { BehaviorResult, PetBehavior } from "./behavior";
import type { PetContext } from "../runtime/pet-context";

export class FallToGroundBehavior implements PetBehavior<PetContext> {
  readonly id = "fall-to-ground";
  readonly priority = 80;
  private readonly speed = 900;

  canEnter(): boolean {
    return true;
  }

  enter(context: PetContext): void {
    context.velocity = { x: 0, y: this.speed };
    context.animations.play("idle");
  }

  update(context: PetContext, deltaMs: number): BehaviorResult {
    const groundY =
      context.workArea.y + context.workArea.height - context.windowSize.height;
    context.position.y = Math.min(
      groundY,
      context.position.y + this.speed * (Math.max(0, deltaMs) / 1000),
    );
    if (context.position.y >= groundY) {
      return { status: "complete", next: "idle" };
    }
    return { status: "running" };
  }

  exit(context: PetContext): void {
    context.velocity.y = 0;
  }
}
