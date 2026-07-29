import { describe, expect, it } from "vitest";

import { butterflyWingScale } from "../src/app/stage/butterfly-actor";

describe("butterfly actor motion", () => {
  it("opens and closes the wings twice per 240 millisecond cycle", () => {
    expect(butterflyWingScale(0)).toBe(1);
    expect(butterflyWingScale(60)).toBeCloseTo(0.35);
    expect(butterflyWingScale(120)).toBe(1);
    expect(butterflyWingScale(180)).toBeCloseTo(0.35);
    expect(butterflyWingScale(240)).toBe(1);
  });

  it("normalizes negative elapsed time to the start pose", () => {
    expect(butterflyWingScale(-40)).toBe(1);
  });
});
