import { describe, expect, it } from "vitest";

import { CareStatusView } from "../src/app/interactions/care-status-view";

describe("CareStatusView", () => {
  it("renders energy hunger and affection below the pet", () => {
    const root = document.createElement("div");
    const view = new CareStatusView(root);

    view.show(
      { satiety: 62, energy: 74, affection: 9, lastUpdatedAt: 1_000 },
      { x: 12, y: 127 },
      116,
    );

    expect(root.hidden).toBe(false);
    expect(root.style.getPropertyValue("--status-x")).toBe("12px");
    expect(root.querySelector('[data-stat="energy"]')?.textContent).toContain(
      "74",
    );
    expect(root.querySelector('[data-stat="hunger"]')?.textContent).toContain(
      "38",
    );
    expect(root.querySelector('[data-stat="affection"]')?.textContent).toContain(
      "9",
    );
  });
});
