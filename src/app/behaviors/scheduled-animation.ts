import {
  PhasedActionPlayer,
  type PhasedPlayback,
} from "../animation/phased-action-player";
import type {
  BehaviorAction,
  PhasedActionDefinition,
} from "../pets/schemas";
import type { PetContext } from "../runtime/pet-context";
import type { BehaviorResult, PetBehavior } from "./behavior";

export class ScheduledAnimationBehavior implements PetBehavior<PetContext> {
  readonly id: string;
  readonly priority = 10;
  private elapsedMs = 0;
  private durationMs = 0;
  private phasedPlayer: PhasedActionPlayer | undefined;

  constructor(
    private readonly action: BehaviorAction,
    private readonly phasedDefinition?: PhasedActionDefinition,
  ) {
    this.id = `action-${action.id}`;
  }

  canEnter(context: PetContext): boolean {
    return (
      !context.paused &&
      context.animations.hasCapability(this.action.capability)
    );
  }

  enter(context: PetContext): void {
    this.elapsedMs = 0;
    this.phasedPlayer = undefined;
    this.durationMs =
      this.action.playback === "once"
        ? context.animations.durationMs(this.action.capability)
        : this.action.minDurationMs +
          Math.min(1, Math.max(0, context.random())) *
            (this.action.maxDurationMs - this.action.minDurationMs);
    context.velocity = { x: 0, y: 0 };
    context.cooldowns.mark(
      this.action.id,
      context.elapsedMs,
      this.action.cooldownMs,
    );
    if (this.phasedDefinition) {
      const definition =
        this.action.playback === "timed"
          ? {
              ...this.phasedDefinition,
              loopDuration: {
                minMs: this.action.minDurationMs,
                maxMs: this.action.maxDurationMs,
              },
            }
          : this.phasedDefinition;
      this.phasedPlayer = new PhasedActionPlayer(
        definition,
        context.animations,
        context.random,
      );
      const playback: PhasedPlayback =
        this.action.playback === "timed" ? "timed" : "once";
      this.phasedPlayer.start(playback);
    } else {
      context.animations.play(this.action.capability, true);
    }
  }

  update(context: PetContext, deltaMs: number): BehaviorResult {
    if (context.paused) {
      return { status: "complete", next: "idle" };
    }
    if (this.phasedPlayer) {
      return this.phasedPlayer.update(deltaMs) === "complete"
        ? { status: "complete", next: "idle" }
        : { status: "running" };
    }
    this.elapsedMs += Math.max(0, deltaMs);
    return this.elapsedMs >= this.durationMs
      ? { status: "complete", next: "idle" }
      : { status: "running" };
  }

  exit(): void {}
}
