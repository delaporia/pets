import type { PetContext } from "../runtime/pet-context";
import { setActivityAnchor } from "../runtime/pet-context";
import type { BehaviorResult, PetBehavior } from "./behavior";

export class LandingBehavior implements PetBehavior<PetContext> {
  readonly id = "landing";
  readonly priority = 90;
  private elapsedMs = 0;
  private durationMs = 0;

  canEnter(): boolean {
    return true;
  }

  enter(context: PetContext): void {
    this.elapsedMs = 0;
    context.velocity = { x: 0, y: 0 };
    setActivityAnchor(context);
    const configured = context.behaviorProfile.interaction.landCapability;
    const capability = context.animations.hasCapability(configured)
      ? configured
      : "idle";
    this.durationMs = context.animations.durationMs(capability);
    context.animations.play(capability, true);
  }

  update(_context: PetContext, deltaMs: number): BehaviorResult {
    this.elapsedMs += Math.max(0, deltaMs);
    return this.elapsedMs >= this.durationMs
      ? { status: "complete", next: "idle" }
      : { status: "running" };
  }

  exit(): void {}
}
