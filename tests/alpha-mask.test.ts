import { describe, expect, it } from "vitest";

import { AlphaMask } from "../src/app/renderer/alpha-mask";

describe("AlphaMask", () => {
  it("uses the configured alpha threshold", () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 0,
      0, 0, 0, 127,
      0, 0, 0, 128,
      0, 0, 0, 255,
    ]);
    const mask = AlphaMask.fromImageData(
      { data: pixels, width: 2, height: 2 } as ImageData,
      128,
    );

    expect(mask.hit(0, 0)).toBe(false);
    expect(mask.hit(1, 0)).toBe(false);
    expect(mask.hit(0, 1)).toBe(true);
    expect(mask.hit(1, 1)).toBe(true);
    expect(mask.toPayload()).toEqual({
      width: 2,
      height: 2,
      threshold: 128,
      pixels: [0, 0, 255, 255],
    });
  });

  it("treats points outside the mask as transparent", () => {
    const mask = AlphaMask.fromImageData(
      {
        data: new Uint8ClampedArray([0, 0, 0, 255]),
        width: 1,
        height: 1,
      } as ImageData,
      1,
    );

    expect(mask.hit(-1, 0)).toBe(false);
    expect(mask.hit(1, 0)).toBe(false);
    expect(mask.hit(0, 1)).toBe(false);
  });
});
