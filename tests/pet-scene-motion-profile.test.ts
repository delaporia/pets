import { describe, expect, it } from "vitest";

import { petSceneMotionProfileFor } from "../src/app/scenes/pet-scene-motion-profile";

describe("pet scene motion profiles", () => {
  it("gives each pet a distinct chase temperament", () => {
    const wuyi = petSceneMotionProfileFor("wuyi");
    const ying = petSceneMotionProfileFor("ying");
    const baitang = petSceneMotionProfileFor("baitang");
    const duobi = petSceneMotionProfileFor("duobi");

    expect(ying.runBobPx).toBeGreaterThan(wuyi.runBobPx);
    expect(ying.pounceStretch).toBeGreaterThan(baitang.pounceStretch);
    expect(duobi.strideScale).toBeGreaterThan(wuyi.strideScale);
  });
});
