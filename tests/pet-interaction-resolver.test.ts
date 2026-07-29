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
    expect(resolvePetInteraction(wuyi, "touch-belly")).toEqual({
      kind: "semantic",
      source: "fallback",
      actionId: "pet",
    });
  });

  it("keeps shared scenes and falls back by category", async () => {
    const wuyi = await manifest("wuyi");

    expect(resolvePetInteraction(wuyi, "feed-treat")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "feed-treat",
      scene: "treat",
    });
    expect(resolvePetInteraction(wuyi, "play-butterfly")).toEqual({
      kind: "scene",
      source: "shared",
      actionId: "play-butterfly",
      scene: "butterfly",
    });
    expect(resolvePetInteraction(wuyi, "feed-can")).toEqual({
      kind: "semantic",
      source: "fallback",
      actionId: "feed",
    });
    expect(resolvePetInteraction(wuyi, "play-wand")).toEqual({
      kind: "semantic",
      source: "fallback",
      actionId: "play",
    });
  });
});
