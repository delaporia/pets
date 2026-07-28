import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const COLUMNS = 8;
const ROWS = 4;

describe("Ying detailed interaction atlas", () => {
  it("contains 32 complete transparent sprite cells without chroma spill", async () => {
    const atlas = join(
      process.cwd(),
      "src/assets/pets/ying/interactions.webp",
    );
    const image = sharp(atlas);
    const metadata = await image.metadata();

    expect(metadata.width).toBe(CELL_WIDTH * COLUMNS);
    expect(metadata.height).toBe(CELL_HEIGHT * ROWS);
    expect(metadata.hasAlpha).toBe(true);

    const { data } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let greenSpillPixels = 0;

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        let visiblePixels = 0;
        for (let y = 0; y < CELL_HEIGHT; y += 1) {
          for (let x = 0; x < CELL_WIDTH; x += 1) {
            const atlasX = column * CELL_WIDTH + x;
            const atlasY = row * CELL_HEIGHT + y;
            const offset =
              (atlasY * CELL_WIDTH * COLUMNS + atlasX) * 4;
            const red = data[offset] ?? 0;
            const green = data[offset + 1] ?? 0;
            const blue = data[offset + 2] ?? 0;
            const alpha = data[offset + 3] ?? 0;
            if (alpha >= 16) visiblePixels += 1;
            if (
              alpha >= 16 &&
              green > 120 &&
              green > red * 1.55 &&
              green > blue * 1.55
            ) {
              greenSpillPixels += 1;
            }
          }
        }
        expect(
          visiblePixels,
          `interaction row ${row} frame ${column} is incomplete`,
        ).toBeGreaterThan(3_000);
      }
    }

    expect(greenSpillPixels).toBe(0);
  });
});
