import { describe, expect, it } from "vitest";

import { PointerGestureTracker } from "../src/app/interactions/pointer-gesture";

describe("PointerGestureTracker", () => {
  it("classifies secondary button input as a context menu without opening a gesture", () => {
    const tracker = new PointerGestureTracker(6);

    expect(
      tracker.down(
        7,
        { x: 10, y: 10 },
        { button: 2, scaleFactor: 1 },
      ),
    ).toBe("context-menu");
    expect(tracker.end(7)).toBe("ignored");
  });

  it("scales the drag threshold for physical high-DPI coordinates", () => {
    const tracker = new PointerGestureTracker(6);
    tracker.down(
      7,
      { x: 10, y: 10 },
      { button: 0, scaleFactor: 2 },
    );

    expect(tracker.move(7, { x: 20, y: 10 })).toBe("pending");
    expect(tracker.move(7, { x: 23, y: 10 })).toBe("drag-start");
  });

  it("emits a click when movement stays within six logical pixels", () => {
    const tracker = new PointerGestureTracker(6);
    tracker.down(7, { x: 10, y: 10 });

    expect(tracker.move(7, { x: 14, y: 13 })).toBe("pending");
    expect(tracker.end(7)).toBe("click");
  });

  it("starts one drag after movement exceeds six logical pixels", () => {
    const tracker = new PointerGestureTracker(6);
    tracker.down(7, { x: 10, y: 10 });

    expect(tracker.move(7, { x: 17, y: 10 })).toBe("drag-start");
    expect(tracker.move(7, { x: 30, y: 10 })).toBe("dragging");
    expect(tracker.end(7)).toBe("drag-end");
  });

  it("ignores another pointer id", () => {
    const tracker = new PointerGestureTracker(6);
    tracker.down(7, { x: 10, y: 10 });

    expect(tracker.move(8, { x: 30, y: 10 })).toBe("ignored");
    expect(tracker.end(8)).toBe("ignored");
  });

  it("does not let a second pointer replace an active gesture", () => {
    const tracker = new PointerGestureTracker(6);
    expect(tracker.down(7, { x: 10, y: 10 })).toBe("pending");
    expect(
      tracker.down(
        8,
        { x: 30, y: 10 },
        { button: 2, scaleFactor: 1 },
      ),
    ).toBe("ignored");

    expect(tracker.move(7, { x: 30, y: 10 })).toBe("drag-start");
    expect(tracker.end(7)).toBe("drag-end");
  });

  it("cancels without emitting a click", () => {
    const tracker = new PointerGestureTracker(6);
    tracker.down(7, { x: 10, y: 10 });

    expect(tracker.cancel(7)).toBe("cancelled");
    expect(tracker.end(7)).toBe("ignored");
  });
});
