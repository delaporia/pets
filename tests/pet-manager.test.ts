import { describe, expect, it, vi } from "vitest";

import { PetManager } from "../src/app/pets/pet-manager";
import type { LoadedPet } from "../src/app/pets/pet-loader";
import { parseCatalog, parsePetManifest } from "../src/app/pets/schemas";

function loadedPet(id: string): LoadedPet {
  return {
    manifest: parsePetManifest({
      schemaVersion: 1,
      id,
      displayName: id,
      description: "",
      spriteVersionNumber: 2,
      display: { scale: 1 },
      atlases: {
        main: {
          path: "sheet.webp",
          cellWidth: 1,
          cellHeight: 1,
          columns: 1,
          rows: 3,
        },
      },
      animations: {
        idle: { atlas: "main", row: 0, frames: [0], fps: 1, loop: true },
        walkRight: {
          atlas: "main",
          row: 1,
          frames: [0],
          fps: 1,
          loop: true,
        },
        walkLeft: {
          atlas: "main",
          row: 2,
          frames: [0],
          fps: 1,
          loop: true,
        },
      },
      capabilities: {
        idle: "idle",
        walkRight: "walkRight",
        walkLeft: "walkLeft",
      },
    }),
    images: new Map([["main", {} as HTMLImageElement]]),
  };
}

const catalog = parseCatalog({
  schemaVersion: 1,
  defaultPet: "wuyi",
  pets: ["wuyi", "placeholder"],
});

describe("PetManager", () => {
  it("loads the saved pet first when it is registered", async () => {
    const load = vi.fn(async (id: string) => loadedPet(id));
    const manager = new PetManager(catalog, "placeholder", load, vi.fn());

    expect((await manager.initialize()).manifest.id).toBe("placeholder");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falls back from a missing saved pet to the catalog default", async () => {
    const load = vi.fn(async (id: string) => loadedPet(id));
    const manager = new PetManager(catalog, "missing", load, vi.fn());

    expect((await manager.initialize()).manifest.id).toBe("wuyi");
  });

  it("falls back to placeholder when the default fails", async () => {
    const load = vi.fn(async (id: string) => {
      if (id === "wuyi") throw new Error("bad atlas");
      return loadedPet(id);
    });
    const manager = new PetManager(catalog, "missing", load, vi.fn());

    expect((await manager.initialize()).manifest.id).toBe("placeholder");
  });

  it("retains the current pet when switching fails", async () => {
    const load = vi.fn(async (id: string) => {
      if (id === "placeholder") throw new Error("bad atlas");
      return loadedPet(id);
    });
    const manager = new PetManager(catalog, "wuyi", load, vi.fn());
    await manager.initialize();

    await expect(manager.switchTo("placeholder")).rejects.toThrow(/bad atlas/);
    expect(manager.current?.manifest.id).toBe("wuyi");
  });

  it("persists only after a replacement has loaded", async () => {
    const order: string[] = [];
    const load = vi.fn(async (id: string) => {
      order.push(`load:${id}`);
      return loadedPet(id);
    });
    const persist = vi.fn(async (id: string) => {
      order.push(`save:${id}`);
    });
    const manager = new PetManager(catalog, "wuyi", load, persist);
    await manager.initialize();
    order.length = 0;

    await manager.switchTo("placeholder");

    expect(order).toEqual(["load:placeholder", "save:placeholder"]);
    expect(manager.current?.manifest.id).toBe("placeholder");
  });
});
