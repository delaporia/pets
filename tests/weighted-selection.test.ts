import { describe, expect, it } from "vitest";

import { selectWeighted } from "../src/app/behaviors/weighted-selection";

describe("selectWeighted", () => {
  const items = [
    { id: "quiet", weight: 1 },
    { id: "social", weight: 3 },
  ];

  it("returns undefined when no positive weight exists", () => {
    expect(selectWeighted([], () => 1, 0.5)).toBeUndefined();
    expect(
      selectWeighted([{ id: "off", weight: 0 }], (item) => item.weight, 0),
    ).toBeUndefined();
  });

  it("excludes zero-weight entries", () => {
    const selected = selectWeighted(
      [
        { id: "off", weight: 0 },
        { id: "on", weight: 1 },
      ],
      (item) => item.weight,
      0,
    );
    expect(selected?.id).toBe("on");
  });

  it("selects deterministic lower and upper weighted ranges", () => {
    expect(selectWeighted(items, (item) => item.weight, 0)?.id).toBe("quiet");
    expect(selectWeighted(items, (item) => item.weight, 0.24)?.id).toBe(
      "quiet",
    );
    expect(selectWeighted(items, (item) => item.weight, 0.25)?.id).toBe(
      "social",
    );
    expect(selectWeighted(items, (item) => item.weight, 1)?.id).toBe("social");
  });

  it("treats negative weights as unavailable", () => {
    expect(
      selectWeighted(
        [
          { id: "negative", weight: -10 },
          { id: "positive", weight: 2 },
        ],
        (item) => item.weight,
        0,
      )?.id,
    ).toBe("positive");
  });
});
