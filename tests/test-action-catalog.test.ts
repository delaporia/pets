import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parsePetManifest, semanticActionIds } from "../src/app/pets/schemas";
import { testActionCatalog } from "../src/app/interactions/test-action-catalog";

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

describe("testActionCatalog", () => {
  it("lists every standard action for every pet", async () => {
    const catalog = testActionCatalog(await manifest("wuyiyi"));

    const standard = catalog
      .filter(({ kind }) => kind === "semantic")
      .map(({ id }) => id);
    expect(new Set(standard)).toEqual(new Set(semanticActionIds));
  });

  it("keeps feeding and play on the first test-mode page", async () => {
    const firstPage = testActionCatalog(await manifest("wuyiyi"))
      .slice(0, 6)
      .map(({ id }) => id);

    expect(firstPage).toEqual([
      "idle",
      "pet",
      "feed",
      "play",
      "sleep",
      "groom",
    ]);
  });

  it("contains only the twelve semantic actions for every pet", async () => {
    const catalog = testActionCatalog(await manifest("ying"));
    expect(catalog.map(({ id }) => id)).toEqual([
      "idle",
      "pet",
      "feed",
      "play",
      "sleep",
      "groom",
      "walkLeft",
      "walkRight",
      "look",
      "stretch",
      "pickedUp",
      "land",
    ]);
  });

  it("builds finite preview steps for looping semantic actions", async () => {
    const sleep = testActionCatalog(await manifest("wuyiyi"))
      .find(({ id }) => id === "sleep")!;

    expect(sleep.steps.length).toBeGreaterThanOrEqual(2);
    expect(sleep.steps.every(({ durationMs }) => durationMs > 0)).toBe(true);
    expect(sleep.steps.at(-1)?.clip).toBe("curlSleepExit");
  });
});
