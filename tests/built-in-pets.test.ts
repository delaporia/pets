import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseCatalog,
  parsePetManifest,
  semanticActionIds,
} from "../src/app/pets/schemas";
import { createPetChasesButterflyScene } from "../src/app/scenes/pet-chases-butterfly";
import { createPetEatsTreatScene } from "../src/app/scenes/pet-eats-treat";

const petsRoot = join(process.cwd(), "src", "assets", "pets");

describe("built-in pet manifests", () => {
  it("ships the five named cats in the intended picker order", async () => {
    const catalog = parseCatalog(
      JSON.parse(await readFile(join(petsRoot, "catalog.json"), "utf8")),
    );

    expect(catalog.pets).toEqual([
      "wuyi",
      "wuyiyi",
      "ying",
      "baitang",
      "duobi",
    ]);

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
      "五一一",
      "瑛",
      "白糖",
      "多比",
    ]);
    for (const manifest of manifests) {
      expect(manifest.sceneEngine).toBe("realtime-v1");
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
      for (const capability of [
        "idle",
        "walkRight",
        "walkLeft",
        "look",
        "pet",
        "feed",
        "play",
      ] as const) {
        const animationId = manifest.capabilities[capability];
        expect(
          animationId,
          `${manifest.id} must declare ${capability}`,
        ).toBeDefined();
        if (!animationId) continue;
        expect(
          manifest.animations[animationId],
          `${manifest.id} must resolve ${capability}`,
        ).toBeDefined();
      }
    }
  });

  it("keeps Wuyi and Wuyiyi as separate selectable identities", async () => {
    const [wuyi, wuyiyi] = await Promise.all(
      ["wuyi", "wuyiyi"].map(async (petId) =>
        parsePetManifest(
          JSON.parse(
            await readFile(join(petsRoot, petId, "pet.json"), "utf8"),
          ),
        ),
      ),
    );

    expect(wuyi!.id).toBe("wuyi");
    expect(wuyiyi!.id).toBe("wuyiyi");
    expect(wuyi!.displayName).toBe("五一");
    expect(wuyiyi!.displayName).toBe("五一一");
    expect(wuyiyi!.description).toContain("LH");
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

  it("uses Duobi's dedicated curled sleep and paw-groom action atlas", async () => {
    const duobi = parsePetManifest(
      JSON.parse(
        await readFile(join(petsRoot, "duobi", "pet.json"), "utf8"),
      ),
    );

    expect(duobi.atlases.actionsV2).toMatchObject({
      path: "actions-v2.webp",
      columns: 8,
      rows: 2,
    });
    expect(duobi.actions.sleep).toMatchObject({
      enter: "curlSleepEnter",
      loop: "curlSleepLoop",
      exit: "curlSleepExit",
    });
    expect(duobi.capabilities.groom).toBe("pawGroom");
    expect(duobi.animations.pawGroom?.frames).toHaveLength(8);
  });

  it("uses Wuyiyi's dedicated desktop action atlas", async () => {
    const wuyiyi = parsePetManifest(
      JSON.parse(
        await readFile(join(petsRoot, "wuyiyi", "pet.json"), "utf8"),
      ),
    );

    expect(wuyiyi.atlases.actionsV3).toMatchObject({
      path: "actions-v3.webp",
      columns: 8,
      rows: 4,
    });
    expect(wuyiyi.actions.sleep).toMatchObject({
      enter: "curlSleepEnter",
      loop: "curlSleepLoop",
      exit: "curlSleepExit",
    });
    expect(wuyiyi.actions.feed).toMatchObject({
      enter: "eatPropEnter",
      loop: "eatPropLoop",
      exit: "eatPropExit",
    });
    expect(wuyiyi.capabilities.groom).toBe("pawGroom");
    expect(wuyiyi.capabilities.pickedUp).toBe("pickedUpDetailed");
    expect(wuyiyi.animations.pawGroom?.frames).toHaveLength(8);
  });

  it("resolves every shared realtime scene clip for every built-in pet", async () => {
    const catalog = parseCatalog(
      JSON.parse(await readFile(join(petsRoot, "catalog.json"), "utf8")),
    );
    for (const petId of catalog.pets) {
      const manifest = parsePetManifest(
        JSON.parse(
          await readFile(join(petsRoot, petId, "pet.json"), "utf8"),
        ),
      );
      const scenes = [
        createPetEatsTreatScene({
          petEntityId: petId,
          origin: { x: 400, y: 700 },
          direction: "right",
        }),
        createPetChasesButterflyScene({
          petEntityId: petId,
          origin: { x: 400, y: 700 },
          direction: "right",
          distance: "near",
          pathVariant: 1,
          endingVariant: "escape",
        }),
      ];
      for (const scene of scenes) {
        const track = scene.animationTracks.find(
          ({ entityId }) => entityId === petId,
        );
        expect(track, `${petId} missing its scene track`).toBeDefined();
        for (const keyframe of track!.keyframes) {
          const resolved =
            manifest.capabilities[keyframe.clip] ?? keyframe.clip;
          expect(
            manifest.animations[resolved],
            `${petId} cannot resolve ${keyframe.clip} in ${scene.id}`,
          ).toBeDefined();
        }
      }
    }
  });
});
