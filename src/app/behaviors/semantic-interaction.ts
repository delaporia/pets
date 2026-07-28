import {
  PhasedActionPlayer,
  type PhasedPlayback,
} from "../animation/phased-action-player";
import type { PhasedActionDefinition } from "../pets/schemas";
import type { PetContext } from "../runtime/pet-context";
import type { BehaviorResult, PetBehavior } from "./behavior";

export class SemanticInteractionBehavior
  implements PetBehavior<PetContext>
{
  readonly id: string;
  readonly priority = 50;
  private player: PhasedActionPlayer | undefined;
  private exitRequested = false;
  private exitStarted = false;

  constructor(
    readonly actionId: string,
    private readonly definition: PhasedActionDefinition,
    private readonly playback: PhasedPlayback,
  ) {
    this.id = `interaction-${actionId}`;
  }

  canEnter(context: PetContext): boolean {
    return !context.paused;
  }

  enter(context: PetContext): void {
    this.exitRequested = false;
    this.exitStarted = false;
    context.velocity = { x: 0, y: 0 };
    this.player = new PhasedActionPlayer(
      this.definition,
      context.animations,
      context.random,
    );
    this.player.start(this.playback);
  }

  requestExit(): void {
    this.exitRequested = true;
  }

  update(context: PetContext, deltaMs: number): BehaviorResult {
    if (!this.player || context.paused) {
      return { status: "complete", next: "idle" };
    }
    if (this.exitRequested && !this.exitStarted) {
      this.exitStarted = true;
      if (this.player.stop() === "complete") {
        return { status: "complete", next: "idle" };
      }
    }
    return this.player.update(deltaMs) === "complete"
      ? { status: "complete", next: "idle" }
      : { status: "running" };
  }

  exit(): void {
    this.player = undefined;
    this.exitRequested = false;
    this.exitStarted = false;
  }
}
