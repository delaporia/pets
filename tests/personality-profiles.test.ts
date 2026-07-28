import { describe, expect, it } from "vitest";

import { personalityProfiles } from "../src/app/personality/profiles";

describe("personality profiles", () => {
  it("defines the approved scheduler and movement values", () => {
    expect(personalityProfiles.quiet).toMatchObject({
      schedulerMinMs: 8_000,
      schedulerMaxMs: 20_000,
      walkSpeed: 30,
      runSpeed: 55,
    });
    expect(personalityProfiles.balanced).toMatchObject({
      schedulerMinMs: 3_000,
      schedulerMaxMs: 8_000,
      walkSpeed: 45,
      runSpeed: 80,
    });
    expect(personalityProfiles.lively).toMatchObject({
      schedulerMinMs: 1_000,
      schedulerMaxMs: 4_000,
      walkSpeed: 65,
      runSpeed: 110,
    });
  });
});
