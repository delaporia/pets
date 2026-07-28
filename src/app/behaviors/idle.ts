import type { BehaviorResult, PetBehavior } from "./behavior";
import type { PetContext } from "../runtime/pet-context";
import { personalityProfiles } from "../personality/profiles";
import type {
  BehaviorAction,
  BehaviorCategory,
} from "../pets/schemas";
import { selectWeighted } from "./weighted-selection";
import {
  careWeightMultiplier,
  personalityCategoryMultiplier,
} from "../care/behavior-influence";

interface Candidate {
  id: string;
  category: BehaviorCategory;
  weight: number;
}

export class IdleBehavior implements PetBehavior<PetContext> {
  readonly id = "idle";
  readonly priority = 0;
  private elapsedMs = 0;
  private durationMs = 500;
  private previousActionId: string | undefined;

  canEnter(): boolean {
    return true;
  }

  enter(context: PetContext): void {
    this.elapsedMs = 0;
    const personality = personalityProfiles[context.personalityMode];
    const scheduler = context.behaviorProfile.scheduler;
    const sampledDuration =
      scheduler.minIntervalMs +
      Math.min(1, Math.max(0, context.random())) *
        (scheduler.maxIntervalMs - scheduler.minIntervalMs);
    this.durationMs = Math.max(
      6_000,
      scheduler.recoveryMs,
      sampledDuration * personality.schedulerMultiplier,
    );
    context.velocity = { x: 0, y: 0 };
    context.animations.play("idle");
  }

  update(context: PetContext, deltaMs: number): BehaviorResult {
    if (context.paused || context.interactionActive) {
      return { status: "running" };
    }
    this.elapsedMs += Math.max(0, deltaMs);
    if (this.elapsedMs < this.durationMs) {
      return { status: "running" };
    }
    const candidates = this.candidates(context);
    if (candidates.length === 0) {
      return { status: "running" };
    }
    const alternatives = candidates.filter(
      (candidate) => candidate.id !== this.previousActionId,
    );
    const eligible = alternatives.length > 0 ? alternatives : candidates;
    const categories = [...new Set(eligible.map(({ category }) => category))];
    const category = selectWeighted(
      categories,
      (candidate) =>
        context.behaviorProfile.categoryWeights[candidate] *
        personalityCategoryMultiplier(
          candidate,
          context.personalityMode,
        ),
      context.random(),
    );
    if (!category) return { status: "running" };
    const next = selectWeighted(
      eligible.filter((candidate) => candidate.category === category),
      (candidate) => candidate.weight,
      context.random(),
    )?.id;
    if (!next) {
      return { status: "running" };
    }
    this.previousActionId = next;
    return { status: "complete", next };
  }

  exit(): void {}

  private candidates(context: PetContext): Candidate[] {
    const movement: Candidate[] = [
      { id: "walk-left", category: "movement", weight: 1 },
      { id: "walk-right", category: "movement", weight: 1 },
    ];
    const actions = context.behaviorProfile.actions
      .filter(
        (action) =>
          context.animations.hasCapability(action.capability) &&
          context.cooldowns.isReady(action.id, context.elapsedMs),
      )
      .map((action: BehaviorAction): Candidate => ({
        id: `action-${action.id}`,
        category: action.category,
        weight:
          action.weight *
          careWeightMultiplier(action.id, context.careState),
      }));
    return [...movement, ...actions];
  }
}
