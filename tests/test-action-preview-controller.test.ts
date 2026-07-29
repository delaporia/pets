import { describe, expect, it, vi } from "vitest";

import { TestActionPreviewController } from "../src/app/interactions/test-action-preview-controller";
import type { TestActionEntry } from "../src/app/interactions/test-action-catalog";

const action: TestActionEntry = {
  id: "sleep",
  label: "睡觉",
  kind: "semantic",
  steps: [
    { clip: "sleepEnter", durationMs: 600, loop: false },
    { clip: "sleepLoop", durationMs: 1_000, loop: true },
    { clip: "sleepExit", durationMs: 500, loop: false },
  ],
};

describe("TestActionPreviewController", () => {
  it("plays each finite preview step and returns to idle", () => {
    const play = vi.fn();
    const completed = vi.fn();
    const controller = new TestActionPreviewController({
      play,
      completed,
    });

    controller.start(action);
    controller.update(600);
    controller.update(1_000);
    controller.update(500);

    expect(play.mock.calls).toEqual([
      ["sleepEnter", false],
      ["sleepLoop", true],
      ["sleepExit", false],
      ["idle", true],
    ]);
    expect(completed).toHaveBeenCalledWith(action);
    expect(controller.active).toBe(false);
  });

  it("replaces the current preview when another action is selected", () => {
    const play = vi.fn();
    const controller = new TestActionPreviewController({
      play,
      completed: vi.fn(),
    });

    controller.start(action);
    controller.start({
      id: "pet",
      label: "抚摸",
      kind: "semantic",
      steps: [{ clip: "pet", durationMs: 700, loop: false }],
    });

    expect(play).toHaveBeenLastCalledWith("pet", false);
  });

  it("stops immediately at idle when test mode is left", () => {
    const play = vi.fn();
    const controller = new TestActionPreviewController({
      play,
      completed: vi.fn(),
    });

    controller.start(action);
    controller.stop();

    expect(play).toHaveBeenLastCalledWith("idle", true);
    expect(controller.active).toBe(false);
  });

  it("falls back to idle when desktop animation frames are throttled", () => {
    const play = vi.fn();
    const completed = vi.fn();
    let fallback: (() => void) | undefined;
    const cancel = vi.fn();
    const controller = new TestActionPreviewController({
      play,
      completed,
      schedule: (callback) => {
        fallback = callback;
        return 17;
      },
      cancel,
    });

    controller.start(action);
    fallback?.();

    expect(play).toHaveBeenLastCalledWith("idle", true);
    expect(completed).toHaveBeenCalledWith(action);
    expect(controller.active).toBe(false);
    expect(cancel).toHaveBeenCalledWith(17);
  });
});
