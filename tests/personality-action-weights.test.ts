import { describe, expect, it } from "vitest";

import { personalityCategoryMultiplier } from "../src/app/personality/action-weights";

describe("personality action weights", () => {
  it("keeps quiet and lively personalities behaviorally distinct", () => {
    expect(personalityCategoryMultiplier("rest", "quiet")).toBeGreaterThan(
      personalityCategoryMultiplier("rest", "lively"),
    );
    expect(personalityCategoryMultiplier("movement", "lively")).toBeGreaterThan(
      personalityCategoryMultiplier("movement", "quiet"),
    );
  });

  it("disables autonomous action categories in test mode", () => {
    expect(personalityCategoryMultiplier("ambient", "test")).toBe(0);
    expect(personalityCategoryMultiplier("social", "test")).toBe(0);
  });
});
