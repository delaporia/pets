import { describe, expect, it, vi } from "vitest";

import {
  StageAutonomyController,
  autonomyWeights,
} from "../src/app/behaviors/stage-autonomy";
import type { BehaviorAction } from "../src/app/pets/schemas";

const actions: BehaviorAction[] = [
  {
    id: "look-around",
    capability: "look",
    category: "ambient",
    playback: "timed",
    weight: 4,
    cooldownMs: 10_000,
    minDurationMs: 3_000,
    maxDurationMs: 6_000,
  },
  {
    id: "walk-around",
    capability: "walkRight",
    category: "movement",
    playback: "timed",
    weight: 3,
    cooldownMs: 8_000,
    minDurationMs: 2_500,
    maxDurationMs: 5_000,
  },
  {
    id: "gentle-stretch",
    capability: "stretch",
    category: "ambient",
    playback: "once",
    weight: 2,
    cooldownMs: 20_000,
  },
];

describe("stage autonomy", () => {
  it("derives weights only from the pet action pool and personality", () => {
    const quiet = autonomyWeights(actions, "quiet");
    const lively = autonomyWeights(actions, "lively");

    expect(lively["walk-around"]!).toBeGreaterThan(
      quiet["walk-around"]!,
    );
    expect(quiet["look-around"]!).toBeGreaterThan(
      lively["look-around"]!,
    );
    expect(Object.keys(quiet)).toEqual(actions.map(({ id }) => id));
  });

  it("keeps every autonomous action disabled in manual test mode", () => {
    expect(
      Object.values(autonomyWeights(actions, "test")).every(
        (weight) => weight === 0,
      ),
    ).toBe(true);
  });

  it("uses per-action cooldown and avoids immediate repetition", async () => {
    const play = vi.fn().mockResolvedValue({ status: "completed" });
    const controller = new StageAutonomyController({
      actions,
      getPersonality: () => "balanced",
      isBusy: () => false,
      play,
      random: () => 0,
      initialDelayMs: 1_000,
    });

    controller.update(999);
    expect(play).not.toHaveBeenCalled();
    controller.update(1_000);
    expect(play).toHaveBeenCalledOnce();
    const first = play.mock.calls[0]![0].id;
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.update(20_000);
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.calls[1]![0].id).not.toBe(first);
  });

  it("does not start autonomous work while a user scene is active", () => {
    const play = vi.fn();
    const controller = new StageAutonomyController({
      actions,
      getPersonality: () => "lively",
      isBusy: () => true,
      play,
      random: () => 0,
      initialDelayMs: 0,
    });

    controller.update(10_000);

    expect(play).not.toHaveBeenCalled();
  });
});
