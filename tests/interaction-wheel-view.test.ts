import { describe, expect, it, vi } from "vitest";

import { InteractionWheelView } from "../src/app/interactions/interaction-wheel-view";

describe("InteractionWheelView", () => {
  it("renders the approved four-icon primary wheel", () => {
    const root = document.createElement("div");
    const view = new InteractionWheelView(root, { getAffection: () => 100 });

    view.open();

    expect(root.dataset.phase).toBe("primary");
    expect(
      [...root.querySelectorAll<HTMLButtonElement>("button")].map(
        (button) => button.getAttribute("aria-label"),
      ),
    ).toEqual(["亲近", "喂食", "玩耍", "陪伴"]);
  });

  it("hides the primary wheel before showing food choices", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const view = new InteractionWheelView(root, { getAffection: () => 100 });
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
    const view = new InteractionWheelView(root, {
      select,
      getAffection: () => 100,
    });
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

  it("uses image icons from the unified cute icon set", () => {
    const root = document.createElement("div");
    const view = new InteractionWheelView(root);

    view.open();

    const icons = root.querySelectorAll<HTMLImageElement>(
      ".interaction-orb img",
    );
    expect(icons).toHaveLength(4);
    expect(
      [...icons].every((icon) =>
        /(?:\.svg|image\/svg\+xml)/.test(icon.src),
      ),
    ).toBe(true);
  });
});
