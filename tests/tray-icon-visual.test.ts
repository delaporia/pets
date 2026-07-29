import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

describe("menu-bar cat head icon", () => {
  it("uses transparent corners and fills the 32px canvas without a background tile", async () => {
    const icon = sharp(
      join(process.cwd(), "src-tauri/icons/tray-32.png"),
    );
    const metadata = await icon.metadata();
    expect(metadata.width).toBe(32);
    expect(metadata.height).toBe(32);
    expect(metadata.hasAlpha).toBe(true);

    const { data } = await icon
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const visible: Array<{ x: number; y: number }> = [];
    let chromaGreen = 0;
    let cyanTilePixels = 0;
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const offset = (y * 32 + x) * 4;
        const red = data[offset] ?? 0;
        const green = data[offset + 1] ?? 0;
        const blue = data[offset + 2] ?? 0;
        const alpha = data[offset + 3] ?? 0;
        if (alpha >= 16) visible.push({ x, y });
        if (
          alpha >= 16 &&
          green >= 220 &&
          green > red * 1.6 &&
          green > blue * 1.6
        ) {
          chromaGreen += 1;
        }
        if (
          alpha >= 240 &&
          green >= 130 &&
          blue >= 130 &&
          red <= 90
        ) {
          cyanTilePixels += 1;
        }
      }
    }
    const xs = visible.map(({ x }) => x);
    const ys = visible.map(({ y }) => y);
    expect(Math.max(...xs) - Math.min(...xs) + 1).toBeGreaterThanOrEqual(28);
    expect(Math.max(...ys) - Math.min(...ys) + 1).toBeGreaterThanOrEqual(28);
    expect(data[3]).toBe(0);
    expect(data[(31 * 4) + 3]).toBe(0);
    expect(data[((31 * 32) * 4) + 3]).toBe(0);
    expect(data[((32 * 32 - 1) * 4) + 3]).toBe(0);
    expect(chromaGreen).toBe(0);
    expect(cyanTilePixels).toBeLessThan(80);
  });
});
