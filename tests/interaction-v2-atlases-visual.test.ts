import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const PET_IDS = ["wuyi", "wuyiyi", "ying", "baitang", "duobi"];
const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;

describe("per-pet interaction v2 atlases", () => {
  it("contain sixteen non-empty transparent frames per pet", async () => {
    for (const petId of PET_IDS) {
      const image = sharp(
        join(
          process.cwd(),
          "src/assets/pets",
          petId,
          "interactions-v2.webp",
        ),
      );
      const metadata = await image.metadata();
      expect(metadata.width).toBe(CELL_WIDTH * 8);
      expect(metadata.height).toBe(CELL_HEIGHT * 2);
      expect(metadata.hasAlpha).toBe(true);

      const { data } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let row = 0; row < 2; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          let visiblePixels = 0;
          for (let y = 0; y < CELL_HEIGHT; y += 1) {
            for (let x = 0; x < CELL_WIDTH; x += 1) {
              const atlasX = column * CELL_WIDTH + x;
              const atlasY = row * CELL_HEIGHT + y;
              const alpha =
                data[
                  (atlasY * CELL_WIDTH * 8 + atlasX) * 4 + 3
                ] ?? 0;
              if (alpha >= 16) visiblePixels += 1;
            }
          }
          expect(
            visiblePixels,
            `${petId} row ${row} frame ${column} is empty`,
          ).toBeGreaterThan(2_000);
        }
      }
    }
  });

  it("contains four complete body-touch rows for every non-Ying pet", async () => {
    for (const petId of ["wuyi", "wuyiyi", "baitang", "duobi"]) {
      const image = sharp(
        join(
          process.cwd(),
          "src/assets/pets",
          petId,
          "touch-v2.webp",
        ),
      );
      const metadata = await image.metadata();
      expect(metadata.width).toBe(CELL_WIDTH * 8);
      expect(metadata.height).toBe(CELL_HEIGHT * 4);
      expect(metadata.hasAlpha).toBe(true);

      const { data } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          let visiblePixels = 0;
          for (let y = 0; y < CELL_HEIGHT; y += 1) {
            for (let x = 0; x < CELL_WIDTH; x += 1) {
              const atlasX = column * CELL_WIDTH + x;
              const atlasY = row * CELL_HEIGHT + y;
              const alpha =
                data[
                  (atlasY * CELL_WIDTH * 8 + atlasX) * 4 + 3
                ] ?? 0;
              if (alpha >= 16) visiblePixels += 1;
            }
          }
          expect(
            visiblePixels,
            `${petId} touch row ${row} frame ${column} is empty`,
          ).toBeGreaterThan(2_000);
        }
      }
    }
  });
});
