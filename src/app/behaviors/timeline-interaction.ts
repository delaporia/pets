import type {
  InteractionTimelineDefinition,
  InteractionTimelineStage,
} from "../pets/schemas";
import type { PetContext } from "../runtime/pet-context";
import type { BehaviorResult, PetBehavior } from "./behavior";

export interface TimelineInteractionObserver {
  onStage(
    actionId: string,
    stage: InteractionTimelineStage,
    index: number,
  ): void;
  onComplete(actionId: string, completed: boolean): void;
}

export class TimelineInteractionBehavior
  implements PetBehavior<PetContext>
{
  readonly id: string;
  readonly priority = 50;
  private stageIndex = 0;
  private elapsedMs = 0;
  private active = false;
  private completed = false;

  constructor(
    readonly actionId: string,
    private readonly definition: InteractionTimelineDefinition,
    private readonly observer: TimelineInteractionObserver,
  ) {
    this.id = `interaction-${actionId}`;
  }

  canEnter(context: PetContext): boolean {
    return !context.paused;
  }

  enter(context: PetContext): void {
    this.stageIndex = 0;
    this.elapsedMs = 0;
    this.active = true;
    this.completed = false;
    context.velocity = { x: 0, y: 0 };
    this.playStage(context);
  }

  update(context: PetContext, deltaMs: number): BehaviorResult {
    if (!this.active || context.paused) {
      return { status: "complete", next: "idle" };
    }
    let remaining = Math.max(0, deltaMs);
    while (remaining >= 0) {
      const stage = this.definition.stages[this.stageIndex];
      if (!stage) return this.finish();
      const untilNext = stage.durationMs - this.elapsedMs;
      if (remaining < untilNext) {
        this.elapsedMs += remaining;
        return { status: "running" };
      }
      remaining -= untilNext;
      this.stageIndex += 1;
      this.elapsedMs = 0;
      if (this.stageIndex >= this.definition.stages.length) {
        return this.finish();
      }
      this.playStage(context);
      if (remaining === 0) return { status: "running" };
    }
    return { status: "running" };
  }

  exit(): void {
    if (this.active && !this.completed) {
      this.observer.onComplete(this.actionId, false);
    }
    this.active = false;
  }

  private playStage(context: PetContext): void {
    const stage = this.definition.stages[this.stageIndex];
    if (!stage) return;
    context.animations.play(stage.animation, true);
    this.observer.onStage(this.actionId, stage, this.stageIndex);
  }

  private finish(): BehaviorResult {
    this.active = false;
    this.completed = true;
    this.observer.onComplete(this.actionId, true);
    return { status: "complete", next: "idle" };
  }
}
