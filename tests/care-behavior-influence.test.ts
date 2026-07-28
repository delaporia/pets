import { describe, expect, it } from "vitest";

import {
  careWeightMultiplier,
  personalityCategoryMultiplier,
} from "../src/app/care/behavior-influence";
import type { PetCareState } from "../src/app/care/care-state";

function care(overrides: Partial<PetCareState> = {}): PetCareState {
  return {
    satiety: 80,
    energy: 80,
    affection: 50,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

describe("care-aware behavior influence", () => {
  it("makes a tired pet more likely to sleep", () => {
    expect(careWeightMultiplier("deep-rest", care({ energy: 10 }))).toBeGreaterThan(
      careWeightMultiplier("deep-rest", care({ energy: 90 })),
    );
  });

  it("suppresses energetic play when needs are low", () => {
    expect(
      careWeightMultiplier(
        "playful-hop",
        care({ energy: 10, satiety: 10 }),
      ),
    ).toBeLessThan(1);
  });

  it("makes a bonded pet more socially responsive", () => {
    expect(
      careWeightMultiplier("pet-response", care({ affection: 90 })),
    ).toBeGreaterThan(
      careWeightMultiplier("pet-response", care({ affection: 10 })),
    );
  });

  it("keeps quiet and lively personalities behaviorally distinct", () => {
    expect(personalityCategoryMultiplier("rest", "quiet")).toBeGreaterThan(
      personalityCategoryMultiplier("rest", "lively"),
    );
    expect(personalityCategoryMultiplier("movement", "lively")).toBeGreaterThan(
      personalityCategoryMultiplier("movement", "quiet"),
    );
  });
});
