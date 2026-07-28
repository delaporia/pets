import type { PetBehavior } from "./behavior";
import { DragAndDropBehavior } from "./drag-and-drop";
import { FallToGroundBehavior } from "./fall-to-ground";
import { GroundWalkBehavior } from "./ground-walk";
import { IdleBehavior } from "./idle";
import { ScheduledAnimationBehavior } from "./scheduled-animation";
import { LandingBehavior } from "./landing";
import type {
  BehaviorProfile,
  PhasedActionDefinition,
  SemanticActionId,
} from "../pets/schemas";
import type { PetContext } from "../runtime/pet-context";

export function createDefaultBehaviors(
  profile: BehaviorProfile,
  semanticActions?: Record<SemanticActionId, PhasedActionDefinition>,
): PetBehavior<PetContext>[] {
  const scheduled = profile.actions.map(
    (action) =>
      new ScheduledAnimationBehavior(
        action,
        semanticActions?.[action.capability as SemanticActionId],
      ),
  );
  return [
    new IdleBehavior(),
    new GroundWalkBehavior("right"),
    new GroundWalkBehavior("left"),
    ...scheduled,
    new FallToGroundBehavior(),
    new LandingBehavior(),
    new DragAndDropBehavior(),
  ];
}
