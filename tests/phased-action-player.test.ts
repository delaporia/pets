import { describe, expect, it, vi } from "vitest";

import { PhasedActionPlayer } from "../src/app/animation/phased-action-player";

function controls() {
  const durations: Record<string, number> = {
    "feed-enter": 500,
    "feed-loop": 1_000,
    "feed-exit": 250,
  };
  return {
    play: vi.fn(),
    durationMs: (animationId: string) => durations[animationId] ?? 100,
  };
}

describe("PhasedActionPlayer", () => {
  it("plays enter, timed loop and exit in order", () => {
    const animation = controls();
    const player = new PhasedActionPlayer(
      {
        enter: "feed-enter",
        loop: "feed-loop",
        exit: "feed-exit",
        loopDuration: { minMs: 2_000, maxMs: 4_000 },
      },
      animation,
      () => 0,
    );

    player.start("timed");
    expect(player.phase).toBe("enter");
    expect(animation.play).toHaveBeenLastCalledWith("feed-enter", true);

    expect(player.update(500)).toBe("running");
    expect(player.phase).toBe("loop");
    expect(animation.play).toHaveBeenLastCalledWith("feed-loop", true);

    expect(player.update(1_999)).toBe("running");
    expect(player.update(1)).toBe("running");
    expect(player.phase).toBe("exit");
    expect(animation.play).toHaveBeenLastCalledWith("feed-exit", true);

    expect(player.update(249)).toBe("running");
    expect(player.update(1)).toBe("complete");
  });

  it("leaves an indefinite loop through its exit phase when stopped", () => {
    const animation = controls();
    const player = new PhasedActionPlayer(
      {
        enter: "feed-enter",
        loop: "feed-loop",
        exit: "feed-exit",
      },
      animation,
      () => 0.5,
    );

    player.start("until-stopped");
    player.update(500);
    expect(player.update(60_000)).toBe("running");

    expect(player.stop()).toBe("running");
    expect(player.phase).toBe("exit");
    expect(animation.play).toHaveBeenLastCalledWith("feed-exit", true);
    expect(player.update(250)).toBe("complete");
  });

  it("plays a loop-only one-shot for exactly one clip cycle", () => {
    const animation = controls();
    const player = new PhasedActionPlayer(
      { loop: "feed-loop" },
      animation,
      () => 0,
    );

    player.start("once");

    expect(player.phase).toBe("loop");
    expect(player.update(999)).toBe("running");
    expect(player.update(1)).toBe("complete");
  });
});
