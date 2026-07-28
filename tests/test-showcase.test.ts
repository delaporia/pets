import { describe, expect, it, vi } from "vitest";

import { TestShowcase } from "../src/app/behaviors/test-showcase";
import {
  semanticActionIds,
  type PhasedActionDefinition,
  type SemanticActionId,
} from "../src/app/pets/schemas";

const actions = Object.fromEntries(
  semanticActionIds.map((id) => [
    id,
    { loop: `${id}-loop` } satisfies PhasedActionDefinition,
  ]),
) as Record<SemanticActionId, PhasedActionDefinition>;

describe("TestShowcase", () => {
  it("plays every action in order with a two-second idle gap", () => {
    const animations = {
      play: vi.fn(),
      durationMs: vi.fn(() => 100),
    };
    const display = { show: vi.fn(), hide: vi.fn() };
    const showcase = new TestShowcase(actions, animations, display);

    showcase.start();
    expect(display.show).toHaveBeenLastCalledWith("待机 · idle");
    expect(animations.play).toHaveBeenLastCalledWith("idle-loop", true);

    showcase.update(2_500);
    expect(display.show).toHaveBeenLastCalledWith("待机 · idle（2 秒）");
    showcase.update(2_000);
    expect(display.show).toHaveBeenLastCalledWith("向左走 · walkLeft");
    expect(animations.play).toHaveBeenLastCalledWith(
      "walkLeft-loop",
      true,
    );
  });

  it("hides the label when test mode stops", () => {
    const display = { show: vi.fn(), hide: vi.fn() };
    const showcase = new TestShowcase(
      actions,
      { play: vi.fn(), durationMs: vi.fn(() => 100) },
      display,
    );

    showcase.start();
    showcase.stop();

    expect(display.hide).toHaveBeenCalledOnce();
  });
});
