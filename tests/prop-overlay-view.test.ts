import { describe, expect, it, vi } from "vitest";

import { PropOverlayView } from "../src/app/interactions/prop-overlay-view";

describe("PropOverlayView", () => {
  it("renders a differentiated feeding prop at the pet", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const view = new PropOverlayView(root);

    const playing = view.play("treat", {
      petOrigin: { x: 190, y: 0 },
      petSize: { width: 116, height: 125 },
      side: "left",
    });

    expect(root.dataset.cue).toBe("treat");
    expect(root.dataset.side).toBe("left");
    expect(root.querySelector('[data-prop="treat"]')).not.toBeNull();
    expect(root.style.getPropertyValue("--pet-origin-x")).toBe("190px");
    expect(root.style.getPropertyValue("--pet-mouth-x")).toBe("259.6px");
    expect(root.style.getPropertyValue("--pet-mouth-y")).toBe("37.5px");
    const treat = root.querySelector<HTMLElement>('[data-prop="treat"]');
    expect(treat?.style.left).toBe("259.6px");
    expect(treat?.style.top).toBe("37.5px");

    expect(root.querySelector('[data-effect="tongue"]')).not.toBeNull();

    vi.advanceTimersByTime(4_200);
    await playing;

    expect(root.dataset.cue).toBeUndefined();
    expect(root.children).toHaveLength(0);
    vi.useRealTimers();
  });

  it("builds staged kibble pouring and canned-food excitement", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const view = new PropOverlayView(root);
    const layout = {
      petOrigin: { x: 0, y: 0 },
      petSize: { width: 116, height: 125 },
      side: "right" as const,
    };

    void view.play("kibble", layout);
    expect(root.querySelector('[data-effect="pour"]')).not.toBeNull();
    expect(root.querySelector('[data-effect="bowl"]')).not.toBeNull();

    view.cancel();
    void view.play("can", layout);
    expect(root.querySelector('[data-effect="heart"]')).not.toBeNull();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("follows stages emitted by the shared interaction timeline", () => {
    const root = document.createElement("div");
    const view = new PropOverlayView(root);
    const layout = {
      petOrigin: { x: 0, y: 0 },
      petSize: { width: 116, height: 125 },
      side: "right" as const,
    };

    view.beginTimeline("kibble", layout);
    view.setTimelineStage("approach");
    expect(root.dataset.cue).toBe("kibble");
    expect(root.dataset.stage).toBe("approach");
    expect(
      root.querySelector<HTMLElement>('[data-prop="kibble"]')?.dataset.stage,
    ).toBe("approach");

    view.endTimeline();
    expect(root.children).toHaveLength(0);
    expect(root.dataset.stage).toBeUndefined();
  });

  it("shows body feedback without replacing the active interaction surface", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const view = new PropOverlayView(root);

    view.showBodyFeedback("mischief", "tail", {
      petOrigin: { x: 0, y: 0 },
      petSize: { width: 116, height: 125 },
      side: "right",
    });

    expect(root.querySelector('[data-feedback="mischief"]')).not.toBeNull();
    expect(root.querySelector('[data-zone="tail"]')).not.toBeNull();

    vi.advanceTimersByTime(1_000);
    expect(root.children).toHaveLength(0);
    vi.useRealTimers();
  });
});
