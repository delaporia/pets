import { describe, expect, it, vi } from "vitest";

import { TimelineInteractionBehavior } from "../src/app/behaviors/timeline-interaction";
import type { PetContext } from "../src/app/runtime/pet-context";

describe("TimelineInteractionBehavior", () => {
  it("plays every animation and emits matching prop stages", () => {
    const onStage = vi.fn();
    const onComplete = vi.fn();
    const behavior = new TimelineInteractionBehavior(
      "feed-kibble",
      {
        stages: [
          {
            id: "approach",
            animation: "walkRight",
            durationMs: 900,
            propState: "bowl",
          },
          {
            id: "pour",
            animation: "observe",
            durationMs: 1_100,
            propState: "pour",
          },
          {
            id: "eat",
            animation: "feedLoop",
            durationMs: 2_000,
            propState: "eat",
          },
        ],
      },
      { onStage, onComplete },
    );
    const context = {
      paused: false,
      velocity: { x: 4, y: 2 },
      animations: { play: vi.fn() },
    } as unknown as PetContext;

    behavior.enter(context);
    expect(context.animations.play).toHaveBeenLastCalledWith("walkRight", true);
    expect(onStage).toHaveBeenLastCalledWith(
      "feed-kibble",
      expect.objectContaining({ id: "approach", propState: "bowl" }),
      0,
    );

    behavior.update(context, 900);
    expect(context.animations.play).toHaveBeenLastCalledWith("observe", true);
    behavior.update(context, 1_100);
    expect(context.animations.play).toHaveBeenLastCalledWith("feedLoop", true);
    expect(behavior.update(context, 2_000)).toEqual({
      status: "complete",
      next: "idle",
    });
    expect(onComplete).toHaveBeenCalledWith("feed-kibble", true);
  });
});
