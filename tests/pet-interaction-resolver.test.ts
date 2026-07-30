import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parsePetManifest } from "../src/app/pets/schemas";
import {
  interactionActionIds,
  resolvePetInteraction,
} from "../src/app/interactions/pet-interaction-resolver";

async function manifest(id: string) {
  return parsePetManifest(
    JSON.parse(
      await readFile(
        join(process.cwd(), "src/assets/pets", id, "pet.json"),
        "utf8",
      ),
    ),
  );
}

describe("pet interaction resolver", () => {
  it("resolves every interaction for every pet", async () => {
    const wuyi = await manifest("wuyi");
    for (const actionId of interactionActionIds) {
      expect(resolvePetInteraction(wuyi, actionId)).toBeDefined();
    }
  });

  it("uses the current pet's exact action before fallback", async () => {
    const ying = await manifest("ying");
    const wuyi = await manifest("wuyi");

    expect(resolvePetInteraction(ying, "touch-belly")).toMatchObject({
      kind: "phased",
      source: "pet",
      actionId: "touch-belly",
    });
    expect(resolvePetInteraction(wuyi, "touch-belly")).toMatchObject({
      kind: "phased",
      source: "pet",
      actionId: "touch-belly",
    });
  });

  it("prefers a pet timeline over the shared scene for the same action", async () => {
    const ying = await manifest("ying");
    const override = {
      ...ying,
      interactionTimelines: {
        ...ying.interactionTimelines,
        "feed-treat": {
          stages: [
            {
              id: "custom-feed",
              animation: "treatEat",
              durationMs: 1000,
            },
          ],
        },
        "play-butterfly": {
          stages: [
            {
              id: "custom-play",
              animation: "butterflyPounce",
              durationMs: 1000,
            },
          ],
        },
      },
    };

    expect(resolvePetInteraction(override, "feed-treat")).toMatchObject({
      kind: "timeline",
      source: "pet",
      actionId: "feed-treat",
    });
    expect(resolvePetInteraction(override, "play-butterfly")).toMatchObject({
      kind: "timeline",
      source: "pet",
      actionId: "play-butterfly",
    });
  });

  it("routes every feeding and play option through a visible shared scene", async () => {
    const wuyi = await manifest("wuyi");

    expect(resolvePetInteraction(wuyi, "feed-treat")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "feed-treat",
      scene: "feed-treat",
    });
    expect(resolvePetInteraction(wuyi, "feed-kibble")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "feed-kibble",
      scene: "feed-kibble",
    });
    expect(resolvePetInteraction(wuyi, "feed-can")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "feed-can",
      scene: "feed-can",
    });
    expect(resolvePetInteraction(wuyi, "play-butterfly")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "play-butterfly",
      scene: "play-butterfly",
    });
    expect(resolvePetInteraction(wuyi, "play-ball")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "play-ball",
      scene: "play-ball",
    });
    expect(resolvePetInteraction(wuyi, "play-wand")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "play-wand",
      scene: "play-wand",
    });
  });
});
