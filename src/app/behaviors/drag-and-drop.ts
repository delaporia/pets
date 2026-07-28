import type { BehaviorResult, PetBehavior } from "./behavior";
import {
  clampPosition,
  setActivityAnchor,
  type PetContext,
} from "../runtime/pet-context";

export class DragAndDropBehavior implements PetBehavior<PetContext> {
  readonly id = "drag-and-drop";
  readonly priority = 100;

  canEnter(context: PetContext): boolean {
    return context.drag.active;
  }

  enter(context: PetContext): void {
    context.velocity = { x: 0, y: 0 };
    const configured =
      context.behaviorProfile.interaction.pickedUpCapability;
    context.animations.play(
      context.animations.hasCapability(configured) ? configured : "idle",
    );
  }

  update(context: PetContext, _deltaMs: number): BehaviorResult {
    if (!context.drag.active) {
      setActivityAnchor(context);
      return { status: "complete", next: "landing" };
    }
    context.position = clampPosition(context, {
      x: context.drag.pointer.x - context.drag.offset.x,
      y: context.drag.pointer.y - context.drag.offset.y,
    });
    return { status: "running" };
  }

  exit(): void {}
}
