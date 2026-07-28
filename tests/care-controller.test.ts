import { describe, expect, it } from "vitest";

import { CareController } from "../src/app/care/care-controller";

describe("CareController", () => {
  it("creates and settles independent state for each pet", () => {
    const controller = new CareController({}, () => 1_000);

    controller.apply("wuyi", "feed");
    const wuyi = controller.get("wuyi");
    const ying = controller.get("ying");

    expect(wuyi.satiety).toBe(100);
    expect(wuyi.affection).toBe(2);
    expect(ying).toMatchObject({
      satiety: 80,
      energy: 80,
      affection: 0,
    });
  });

  it("returns a detached persistence snapshot", () => {
    const controller = new CareController({}, () => 5_000);
    controller.get("wuyi");

    const snapshot = controller.snapshot();
    snapshot.wuyi!.satiety = 0;

    expect(controller.get("wuyi").satiety).toBe(80);
  });
});
