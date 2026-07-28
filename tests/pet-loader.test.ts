import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPet } from "../src/app/pets/pet-loader";

const manifest = {
  schemaVersion: 1,
  id: "wuyi",
  displayName: "Wuyi",
  description: "A desktop companion",
  spriteVersionNumber: 2,
  display: { scale: 0.6 },
  atlases: {
    main: {
      path: "spritesheet.webp",
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 11,
    },
  },
  animations: {
    idle: { atlas: "main", row: 0, frames: [0], fps: 8, loop: true },
    walkRight: {
      atlas: "main",
      row: 1,
      frames: [0],
      fps: 10,
      loop: true,
    },
    walkLeft: {
      atlas: "main",
      row: 2,
      frames: [0],
      fps: 10,
      loop: true,
    },
  },
  capabilities: {
    idle: "idle",
    walkRight: "walkRight",
    walkLeft: "walkLeft",
  },
  actions: {
    idle: { loop: "idle" },
    walkLeft: { loop: "walkLeft" },
    walkRight: { loop: "walkRight" },
    look: { loop: "idle" },
    pet: { loop: "idle" },
    feed: { loop: "idle" },
    sleep: { loop: "idle" },
    groom: { loop: "idle" },
    stretch: { loop: "idle" },
    play: { loop: "idle" },
    pickedUp: { loop: "idle" },
    land: { loop: "idle" },
  },
};

class FakeImage {
  src = "";
  naturalWidth = 1536;
  naturalHeight = 2288;

  async decode(): Promise<void> {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPet", () => {
  it("validates the manifest and preloads every atlas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 })),
    );
    vi.stubGlobal("Image", FakeImage);

    const loaded = await loadPet(new URL("https://example.test/pets/wuyi/"));

    expect(loaded.manifest.id).toBe("wuyi");
    expect(loaded.images.get("main")?.src).toBe(
      "https://example.test/pets/wuyi/spritesheet.webp",
    );
  });

  it("rejects an atlas whose decoded dimensions do not match", async () => {
    class WrongSizeImage extends FakeImage {
      override naturalWidth = 100;
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 })),
    );
    vi.stubGlobal("Image", WrongSizeImage);

    await expect(
      loadPet(new URL("https://example.test/pets/wuyi/")),
    ).rejects.toThrow(/main.*1536x2288.*100x2288/);
  });
});
