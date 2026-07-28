import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const IDLE_FRAME_COUNT = 6;

describe("Baitang idle animation", () => {
  it("does not carry the previous frame's tail into the far-left side", async () => {
    const atlas = join(
      process.cwd(),
      "src/assets/pets/baitang/spritesheet.webp",
    );

    for (let frame = 0; frame < IDLE_FRAME_COUNT; frame += 1) {
      const { data } = await sharp(atlas)
        .extract({
          left: frame * CELL_WIDTH,
          top: 0,
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let visiblePixels = 0;
      for (let y = 130; y < 195; y += 1) {
        for (let x = 0; x < 20; x += 1) {
          if ((data[(y * CELL_WIDTH + x) * 4 + 3] ?? 0) >= 16) {
            visiblePixels += 1;
          }
        }
      }

      expect(
        visiblePixels,
        `idle frame ${frame} has a tail fragment in the far-left band`,
      ).toBe(0);
    }
  });
});
