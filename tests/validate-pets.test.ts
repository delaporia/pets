import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// @ts-expect-error The validator is a Node ESM script.
import { validatePets } from "../scripts/validate-pets.mjs";

const manifest = {
  schemaVersion: 1,
  id: "pet",
  displayName: "Pet",
  description: "",
  spriteVersionNumber: 2,
  display: { scale: 1 },
  atlases: {
    main: {
      path: "spritesheet.webp",
      cellWidth: 1,
      cellHeight: 1,
      columns: 2,
      rows: 3,
    },
  },
  animations: {
    idle: { atlas: "main", row: 0, frames: [0], fps: 1, loop: true },
    walkRight: { atlas: "main", row: 1, frames: [0], fps: 1, loop: true },
    walkLeft: { atlas: "main", row: 2, frames: [0], fps: 1, loop: true },
  },
  capabilities: {
    idle: "idle",
    walkRight: "walkRight",
    walkLeft: "walkLeft",
  },
};

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pet-validator-"));
  await mkdir(join(root, "pet"));
  await writeFile(
    join(root, "catalog.json"),
    JSON.stringify({ schemaVersion: 1, defaultPet: "pet", pets: ["pet"] }),
  );
  await writeFile(join(root, "pet", "pet.json"), JSON.stringify(manifest));
  await sharp({
    create: {
      width: 2,
      height: 3,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .webp({ lossless: true })
    .toFile(join(root, "pet", "spritesheet.webp"));
  return root;
}

describe("validatePets", () => {
  it("accepts a complete built-in pet tree", async () => {
    const result = await validatePets(await fixture());
    expect(result).toEqual({ validPets: ["pet"], errors: [] });
  });

  it("reports duplicate catalog ids", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "catalog.json"),
      JSON.stringify({
        schemaVersion: 1,
        defaultPet: "pet",
        pets: ["pet", "pet"],
      }),
    );
    const result = await validatePets(root);
    expect(result.errors.join("\n")).toMatch(/catalog.*unique/i);
  });

  it("reports exact atlas dimension mismatches", async () => {
    const root = await fixture();
    await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .webp()
      .toFile(join(root, "pet", "spritesheet.webp"));
    const result = await validatePets(root);
    expect(result.errors.join("\n")).toMatch(/pet.*expected 2x3.*received 1x1/i);
  });

  it("reports visual bounds that extend beyond an atlas cell", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "pet", "pet.json"),
      JSON.stringify({
        ...manifest,
        display: {
          scale: 1,
          visualBounds: { left: 0, top: 0, right: 2, bottom: 1 },
          footAnchor: { x: 1, y: 1 },
        },
      }),
    );

    const result = await validatePets(root);

    expect(result.errors.join("\n")).toMatch(/visualBounds.*atlas cell/i);
  });

  it("reports autonomous actions that reference missing capabilities", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "pet", "pet.json"),
      JSON.stringify({
        ...manifest,
        autonomousActions: [{ capability: "wave", playback: "once" }],
      }),
    );

    const result = await validatePets(root);

    expect(result.errors.join("\n")).toMatch(
      /autonomousActions\.0\.capability.*unknown capability/i,
    );
  });

  it("reports behavior actions that reference missing capabilities", async () => {
    const root = await fixture();
    await writeFile(
      join(root, "pet", "pet.json"),
      JSON.stringify({
        ...manifest,
        behaviorProfile: {
          scheduler: {
            minIntervalMs: 6_000,
            maxIntervalMs: 12_000,
            recoveryMs: 6_000,
          },
          movement: {
            walkSpeed: 42,
            minDurationMs: 3_000,
            maxDurationMs: 6_000,
            roamingHalfWidth: 200,
          },
          categoryWeights: {
            movement: 10,
            ambient: 20,
            rest: 30,
            social: 40,
          },
          actions: [
            {
              id: "missing-action",
              capability: "missing",
              category: "social",
              playback: "once",
              weight: 1,
              cooldownMs: 1_000,
            },
          ],
          interaction: {
            nearbyRadius: 240,
            cursorPollMs: 250,
            multiClickWindowMs: 1_800,
            multiClickThreshold: 3,
            pickedUpCapability: "idle",
            landCapability: "idle",
          },
          fallbackCapabilities: ["idle"],
        },
      }),
    );

    const result = await validatePets(root);

    expect(result.errors.join("\n")).toMatch(
      /behaviorProfile\.actions\.0\.capability.*unknown capability/i,
    );
  });

  it("reports semantic action phases that reference missing animations", async () => {
    const root = await fixture();
    const actions = Object.fromEntries(
      [
        "idle",
        "walkLeft",
        "walkRight",
        "look",
        "pet",
        "feed",
        "sleep",
        "groom",
        "stretch",
        "play",
        "pickedUp",
        "land",
      ].map((id) => [id, { loop: id === "feed" ? "missing" : "idle" }]),
    );
    await writeFile(
      join(root, "pet", "pet.json"),
      JSON.stringify({ ...manifest, actions }),
    );

    const result = await validatePets(root);

    expect(result.errors.join("\n")).toMatch(
      /actions\.feed\.loop.*unknown animation/i,
    );
  });

  it("reports a small distant sprite fragment inside an atlas cell", async () => {
    const root = await fixture();
    const cellWidth = 24;
    const cellHeight = 24;
    await writeFile(
      join(root, "pet", "pet.json"),
      JSON.stringify({
        ...manifest,
        atlases: {
          main: {
            path: "spritesheet.webp",
            cellWidth,
            cellHeight,
            columns: 1,
            rows: 3,
          },
        },
      }),
    );
    const pixels = Buffer.alloc(cellWidth * cellHeight * 3 * 4);
    const paint = (x: number, y: number): void => {
      const index = (y * cellWidth + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = 255;
    };
    for (let y = 6; y < 18; y += 1) {
      for (let x = 5; x < 17; x += 1) paint(x, y);
    }
    for (let y = 4; y < 12; y += 1) paint(23, y);
    await sharp(pixels, {
      raw: { width: cellWidth, height: cellHeight * 3, channels: 4 },
    })
      .webp({ lossless: true })
      .toFile(join(root, "pet", "spritesheet.webp"));

    const result = await validatePets(root);

    expect(result.errors.join("\n")).toMatch(
      /pet.*atlas main.*row 0.*column 0.*distant fragment/i,
    );
  });

  it("reports visible pixels outside the declared safe visual bounds", async () => {
    const root = await fixture();
    const cellWidth = 24;
    const cellHeight = 24;
    await writeFile(
      join(root, "pet", "pet.json"),
      JSON.stringify({
        ...manifest,
        display: {
          scale: 1,
          visualBounds: { left: 5, top: 5, right: 19, bottom: 19 },
        },
        atlases: {
          main: {
            path: "spritesheet.webp",
            cellWidth,
            cellHeight,
            columns: 1,
            rows: 3,
          },
        },
      }),
    );
    const pixels = Buffer.alloc(cellWidth * cellHeight * 3 * 4);
    for (let row = 0; row < 3; row += 1) {
      for (let y = 6; y < 18; y += 1) {
        for (let x = 4; x < 20; x += 1) {
          const offset = ((row * cellHeight + y) * cellWidth + x) * 4;
          pixels.fill(255, offset, offset + 4);
        }
      }
    }
    await sharp(pixels, {
      raw: { width: cellWidth, height: cellHeight * 3, channels: 4 },
    })
      .webp({ lossless: true })
      .toFile(join(root, "pet", "spritesheet.webp"));

    const result = await validatePets(root);

    expect(result.errors.join("\n")).toMatch(
      /visible pixels exceed display\.visualBounds/i,
    );
  });
});
