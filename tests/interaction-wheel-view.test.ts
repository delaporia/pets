import { describe, expect, it, vi } from "vitest";

import { InteractionWheelView } from "../src/app/interactions/interaction-wheel-view";

describe("InteractionWheelView", () => {
  it("renders the approved four-icon primary wheel", () => {
    const root = document.createElement("div");
    const view = new InteractionWheelView(root);

    view.open();

    expect(root.dataset.phase).toBe("primary");
    expect(
      [...root.querySelectorAll<HTMLButtonElement>("button")].map(
        (button) => button.getAttribute("aria-label"),
      ),
    ).toEqual(["亲近", "喂食", "玩耍", "睡觉"]);
    for (const option of ["feed", "play"]) {
      expect(
        root.querySelector(
          `[data-option="${option}"] img[data-icon-set="delaporia-v1"]`,
        ),
      ).not.toBeNull();
    }
  });

  it("applies the non-overlapping arc positions to primary choices", () => {
    const root = document.createElement("div");
    root.dataset.side = "right";
    const view = new InteractionWheelView(root);

    view.open();

    expect(
      [...root.querySelectorAll<HTMLButtonElement>("[data-option]")].map(
        (button) => [
          button.style.getPropertyValue("--orb-x"),
          button.style.getPropertyValue("--orb-y"),
        ],
      ),
    ).toEqual([
      ["10px", "-72px"],
      ["54px", "-24px"],
      ["54px", "24px"],
      ["10px", "72px"],
    ]);
  });

  it("hides the primary wheel before showing food choices", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const view = new InteractionWheelView(root);
    view.open();

    root.querySelector<HTMLButtonElement>('[data-option="feed"]')!.click();

    expect(root.dataset.transition).toBe("leaving");
    expect(root.querySelector('[data-option="treat"]')).toBeNull();

    vi.advanceTimersByTime(260);

    expect(root.dataset.phase).toBe("secondary");
    expect(root.dataset.transition).toBe("entering");
    expect(
      root.querySelector<HTMLButtonElement>('[data-option="treat"]'),
    ).not.toBeNull();
    expect(
      root.querySelector(
        '[data-option="treat"] img[data-icon-set="delaporia-v1"]',
      ),
    ).not.toBeNull();
    vi.useRealTimers();
  });

  it("honors the latest primary choice during the retract animation", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const view = new InteractionWheelView(root);
    view.open();

    root.querySelector<HTMLButtonElement>('[data-option="feed"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-option="play"]')!.click();
    vi.advanceTimersByTime(260);

    expect(root.dataset.phase).toBe("secondary");
    expect(
      root.querySelector('[data-option="butterfly"]'),
    ).not.toBeNull();
    expect(root.querySelector('[data-option="treat"]')).toBeNull();
    vi.useRealTimers();
  });

  it("enters direct body interaction after the wheel retracts", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const enterBodyInteraction = vi.fn();
    const view = new InteractionWheelView(root, {
      enterBodyInteraction,
    });
    view.open();

    root.querySelector<HTMLButtonElement>('[data-option="touch"]')!.click();
    vi.advanceTimersByTime(260);

    expect(root.dataset.phase).toBe("body-interaction");
    expect(enterBodyInteraction).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("routes sleep and wake directly from the primary wheel", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const selectPrimary = vi.fn(async () => undefined);
    const view = new InteractionWheelView(root, {
      selectPrimary,
      isAvailable: (option) => option !== "wake",
    });

    view.open();
    root.querySelector<HTMLButtonElement>('[data-option="sleep"]')!.click();
    vi.advanceTimersByTime(250);
    await Promise.resolve();
    await Promise.resolve();

    expect(selectPrimary).toHaveBeenCalledWith("sleep");
    expect(root.dataset.phase).toBe("closed");
    vi.useRealTimers();
  });

  it("keeps the surface open while an interaction performance runs", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    let finish!: () => void;
    const select = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const view = new InteractionWheelView(root, { select });
    view.open();
    root.querySelector<HTMLButtonElement>('[data-option="play"]')!.click();
    vi.advanceTimersByTime(260);

    root.querySelector<HTMLButtonElement>('[data-option="ball"]')!.click();

    expect(select).toHaveBeenCalledWith("ball");
    expect(root.dataset.phase).toBe("performing");
    expect(root.querySelectorAll("button")).toHaveLength(0);

    finish();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.dataset.phase).toBe("closed");
    vi.useRealTimers();
  });

  it("uses image assets instead of text emoji for every option", () => {
    const root = document.createElement("div");
    const view = new InteractionWheelView(root);

    view.open();

    const icons = root.querySelectorAll<HTMLImageElement>(
      ".interaction-orb img",
    );
    expect(icons).toHaveLength(4);
    expect(
      [...icons].every((icon) =>
        /(?:\.(?:png|svg)|image\/)/.test(icon.src),
      ),
    ).toBe(true);
  });
});
