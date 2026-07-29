import { describe, expect, it, vi } from "vitest";

import { TestActionWheelView } from "../src/app/interactions/test-action-wheel-view";
import type { TestActionEntry } from "../src/app/interactions/test-action-catalog";

const actions: TestActionEntry[] = Array.from(
  { length: 8 },
  (_, index) => ({
    id: `action-${index}`,
    label: `动作${index}`,
    kind: "semantic",
    steps: [{ clip: "idle", durationMs: 500, loop: false }],
  }),
);

describe("TestActionWheelView", () => {
  it("shows all actions across compact radial pages", () => {
    const root = document.createElement("div");
    const view = new TestActionWheelView(root, {
      select: vi.fn(),
      close: vi.fn(),
    });

    view.open(actions);
    expect(root.querySelectorAll("[data-test-action]")).toHaveLength(6);
    root.querySelector<HTMLButtonElement>('[data-role="next"]')!.click();

    expect(
      Array.from(root.querySelectorAll("[data-test-action]"))
        .map((element) => (element as HTMLElement).dataset.testAction),
    ).toEqual(["action-6", "action-7"]);
  });

  it("closes before playing the selected action", async () => {
    const root = document.createElement("div");
    const order: string[] = [];
    const view = new TestActionWheelView(root, {
      close: () => order.push("close"),
      select: async (action) => {
        order.push(action.id);
      },
    });

    view.open(actions);
    root.querySelector<HTMLButtonElement>('[data-test-action="action-0"]')!
      .click();
    await Promise.resolve();

    expect(root.dataset.phase).toBe("closed");
    expect(order).toEqual(["close", "action-0"]);
  });
});
