import { describe, expect, it } from "vitest";

import { CooldownLedger } from "../src/app/behaviors/cooldown-ledger";

describe("CooldownLedger", () => {
  it("is ready before an action has been marked", () => {
    expect(new CooldownLedger().isReady("nuzzle", 0)).toBe(true);
  });

  it("blocks until the exact cooldown expiry", () => {
    const ledger = new CooldownLedger();
    ledger.mark("nuzzle", 1_000, 5_000);

    expect(ledger.isReady("nuzzle", 5_999)).toBe(false);
    expect(ledger.isReady("nuzzle", 6_000)).toBe(true);
  });

  it("does not shorten an active cooldown", () => {
    const ledger = new CooldownLedger();
    ledger.mark("nuzzle", 1_000, 5_000);
    ledger.mark("nuzzle", 2_000, 1_000);

    expect(ledger.isReady("nuzzle", 5_999)).toBe(false);
    expect(ledger.isReady("nuzzle", 6_000)).toBe(true);
  });
});
