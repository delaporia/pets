import { describe, expect, it, vi } from "vitest";

import { PetSleepController } from "../src/app/interactions/pet-sleep-controller";

describe("PetSleepController", () => {
  it("uses each pet's enter, loop and exit clips while sharing one state machine", async () => {
    vi.useFakeTimers();
    const play = vi.fn();
    const changed = vi.fn();
    const controller = new PetSleepController(
      {
        enter: "curlSleepEnter",
        loop: "curlSleepLoop",
        exit: "curlSleepExit",
      },
      {
        play,
        durationMs: () => 500,
        changed,
        schedule: (callback, delayMs) =>
          window.setTimeout(callback, delayMs),
        cancel: (handle) => window.clearTimeout(handle),
      },
    );

    expect(controller.sleep()).toBe(true);
    expect(controller.isSleeping).toBe(true);
    expect(play).toHaveBeenLastCalledWith("curlSleepEnter", false);

    vi.advanceTimersByTime(500);
    expect(controller.state).toBe("sleeping");
    expect(play).toHaveBeenLastCalledWith("curlSleepLoop", true);

    const waking = controller.wake();
    expect(controller.isSleeping).toBe(false);
    expect(play).toHaveBeenLastCalledWith("curlSleepExit", false);
    vi.advanceTimersByTime(500);
    await waking;

    expect(controller.state).toBe("awake");
    expect(play).toHaveBeenLastCalledWith("idle", true);
    expect(changed).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("falls back cleanly when a pet has no enter or exit clip", async () => {
    const play = vi.fn();
    const controller = new PetSleepController(
      { loop: "sleepLoop" },
      {
        play,
        durationMs: () => 0,
        changed: vi.fn(),
        schedule: (callback) => {
          callback();
          return 1;
        },
        cancel: vi.fn(),
      },
    );

    expect(controller.sleep()).toBe(true);
    expect(controller.state).toBe("sleeping");
    expect(play).toHaveBeenLastCalledWith("sleepLoop", true);

    await controller.wake();
    expect(controller.state).toBe("awake");
    expect(play).toHaveBeenLastCalledWith("idle", true);
  });

  it("wakes before another interaction and ignores repeated sleep requests", async () => {
    const controller = new PetSleepController(
      { loop: "sleepLoop" },
      {
        play: vi.fn(),
        durationMs: () => 0,
        changed: vi.fn(),
        schedule: (callback) => {
          callback();
          return 1;
        },
        cancel: vi.fn(),
      },
    );

    expect(controller.sleep()).toBe(true);
    expect(controller.sleep()).toBe(false);
    await controller.wakeBeforeInteraction();

    expect(controller.state).toBe("awake");
  });

  it("resets immediately to idle when the runtime switches mode", () => {
    const play = vi.fn();
    const cancel = vi.fn();
    const controller = new PetSleepController(
      { enter: "sleepEnter", loop: "sleepLoop", exit: "sleepExit" },
      {
        play,
        durationMs: () => 500,
        changed: vi.fn(),
        schedule: () => 9,
        cancel,
      },
    );

    controller.sleep();
    controller.reset();

    expect(controller.state).toBe("awake");
    expect(play).toHaveBeenLastCalledWith("idle", true);
    expect(cancel).toHaveBeenCalledWith(9);
  });
});
