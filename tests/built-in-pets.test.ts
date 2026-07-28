import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseCatalog,
  parsePetManifest,
  semanticActionIds,
} from "../src/app/pets/schemas";

const petsRoot = join(process.cwd(), "src", "assets", "pets");

describe("built-in pet manifests", () => {
  it("ships the four named cats in the intended picker order", async () => {
    const catalog = parseCatalog(
      JSON.parse(await readFile(join(petsRoot, "catalog.json"), "utf8")),
    );

    expect(catalog.pets).toEqual(["wuyi", "ying", "baitang", "duobi"]);

    const manifests = await Promise.all(
      catalog.pets.map(async (petId) =>
        parsePetManifest(
          JSON.parse(
            await readFile(join(petsRoot, petId, "pet.json"), "utf8"),
          ),
        ),
      ),
    );

    expect(manifests.map(({ displayName }) => displayName)).toEqual([
      "五一",
      "瑛",
      "白糖",
      "多比",
    ]);
    for (const manifest of manifests) {
      expect(Object.keys(manifest.actions)).toEqual(semanticActionIds);
      expect(Object.keys(manifest.capabilities)).not.toEqual(
        expect.arrayContaining(["failed", "waiting", "working", "review"]),
      );
      expect(Object.keys(manifest.animations)).not.toEqual(
        expect.arrayContaining(["failed", "waiting", "working", "review"]),
      );
      expect(manifest.actions.sleep.enter).toBeDefined();
      expect(manifest.actions.sleep.exit).toBeDefined();
      expect(manifest.actions.sleep.loop).not.toBe(
        manifest.actions.sleep.enter,
      );
      expect(manifest.actions.feed.enter).toBeDefined();
      expect(manifest.actions.feed.exit).toBeDefined();
      expect(manifest.actions.pickedUp.loop).toMatch(/pickedUp/i);
      expect(manifest.actions.land.loop).toMatch(/land/i);
      expect(manifest.actions.pickedUp.loop).not.toBe(
        manifest.actions.stretch.loop,
      );
      expect(manifest.display.visualBounds).toBeDefined();
      expect(manifest.display.footAnchor).toBeDefined();
    }
  });

  it("gives curious Ying a more playful base behavior than Wuyi", async () => {
    const [wuyi, ying] = await Promise.all(
      ["wuyi", "ying"].map(async (petId) =>
        parsePetManifest(
          JSON.parse(
            await readFile(join(petsRoot, petId, "pet.json"), "utf8"),
          ),
        ),
      ),
    );
    const actionWeight = (
      manifest: typeof ying,
      actionId: string,
    ): number =>
      manifest!.behaviorProfile.actions.find(
        (action) => action.id === actionId,
      )!.weight;

    expect(ying!.behaviorProfile.categoryWeights).toEqual({
      movement: 32,
      ambient: 25,
      rest: 12,
      social: 31,
    });
    expect(ying!.behaviorProfile.movement.walkSpeed).toBe(36);
    expect(actionWeight(ying, "playful-hop")).toBeGreaterThan(
      actionWeight(wuyi, "playful-hop"),
    );
    expect(ying!.description).toContain("好奇");
  });

  it("ships Ying's detailed body interactions in a separate atlas", async () => {
    const ying = parsePetManifest(
      JSON.parse(
        await readFile(join(petsRoot, "ying", "pet.json"), "utf8"),
      ),
    );

    expect(ying.atlases.interactions).toMatchObject({
      path: "interactions.webp",
      columns: 8,
      rows: 4,
    });
    expect(ying.animations.touchHeadDetailed!.atlas).toBe("interactions");
    expect(ying.animations.touchChinDetailed!.frames).toHaveLength(8);
    expect(ying.animations.touchBellyDetailed!.frames).toHaveLength(8);
    expect(ying.animations.touchTailDetailed!.frames).toHaveLength(8);
    expect(ying.interactionActions["touch-belly"]!.loop).toBe(
      "touchBellyDetailed",
    );
  });

  it("ships Ying's feeding and play interactions as shared staged timelines", async () => {
    const ying = parsePetManifest(
      JSON.parse(
        await readFile(join(petsRoot, "ying", "pet.json"), "utf8"),
      ),
    );

    expect(ying.interactionTimelines["feed-kibble"]?.stages.map(
      (stage) => stage.propState,
    )).toEqual(["bowl", "approach", "watch", "pour", "eat", "finish"]);
    expect(ying.interactionTimelines["feed-can"]?.stages.some(
      (stage) => stage.propState === "delight",
    )).toBe(true);
    expect(ying.interactionTimelines["feed-treat"]?.stages.some(
      (stage) => stage.propState === "lick",
    )).toBe(true);
    expect(Object.keys(ying.interactionTimelines).sort()).toEqual([
      "feed-can",
      "feed-kibble",
      "feed-treat",
      "play-ball",
      "play-butterfly",
      "play-wand",
    ]);
  });

  it("keeps Wuyi calm enough for long-running desktop use", async () => {
    const manifest = parsePetManifest(
      JSON.parse(await readFile(join(petsRoot, "wuyi", "pet.json"), "utf8")),
    );

    expect(manifest.animations.idle?.fps).toBeLessThanOrEqual(4);
    expect(manifest.animations.walkRight?.fps).toBeLessThanOrEqual(8);
    expect(manifest.animations.walkLeft?.fps).toBeLessThanOrEqual(8);
    expect(manifest.behaviorProfile.scheduler.recoveryMs).toBeGreaterThanOrEqual(
      8_000,
    );
    expect(manifest.behaviorProfile.categoryWeights).toEqual({
      movement: 20,
      ambient: 30,
      rest: 25,
      social: 25,
    });
    expect(
      manifest.behaviorProfile.actions.map((action) => action.capability),
    ).not.toEqual(
      expect.arrayContaining(["failed", "waiting", "working", "review"]),
    );
  });
});
