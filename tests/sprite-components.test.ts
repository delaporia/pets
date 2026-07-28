import { describe, expect, it } from "vitest";

// @ts-expect-error The sprite analyzer is shared with Node validation scripts.
import { analyzeFrame, sanitizeFrame } from "../scripts/lib/sprite-components.mjs";

function frame(width = 24, height = 24) {
  const data = Buffer.alloc(width * height * 4);
  const paint = (x: number, y: number): void => {
    const index = (y * width + x) * 4;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  };
  return { data, width, height, paint };
}

describe("sprite connected components", () => {
  it("detects and removes a small distant edge fragment without changing the body", () => {
    const image = frame();
    for (let y = 6; y < 18; y += 1) {
      for (let x = 5; x < 17; x += 1) image.paint(x, y);
    }
    for (let y = 4; y < 12; y += 1) image.paint(23, y);

    const analysis = analyzeFrame(image, {
      maximumDetachedAreaRatio: 0.08,
      minimumGap: 4,
    });
    expect(analysis.suspiciousComponents).toHaveLength(1);
    expect(analysis.suspiciousComponents[0]).toMatchObject({
      minX: 23,
      maxX: 23,
    });

    const sanitized = sanitizeFrame(image, {
      maximumDetachedAreaRatio: 0.08,
      minimumGap: 4,
    });
    expect(sanitized.data[(8 * 24 + 23) * 4 + 3]).toBe(0);
    expect(sanitized.data[(8 * 24 + 8) * 4 + 3]).toBe(255);
  });

  it("keeps a declared detached visual effect", () => {
    const image = frame();
    for (let y = 6; y < 18; y += 1) {
      for (let x = 5; x < 17; x += 1) image.paint(x, y);
    }
    for (let y = 3; y < 7; y += 1) image.paint(22, y);

    const analysis = analyzeFrame(image, {
      maximumDetachedAreaRatio: 0.08,
      minimumGap: 4,
      allowedRegions: [{ x: 20, y: 1, width: 4, height: 8 }],
    });

    expect(analysis.suspiciousComponents).toHaveLength(0);
    expect(
      sanitizeFrame(image, {
        maximumDetachedAreaRatio: 0.08,
        minimumGap: 4,
        allowedRegions: [{ x: 20, y: 1, width: 4, height: 8 }],
      }).data[(4 * 24 + 22) * 4 + 3],
    ).toBe(255);
  });

  it("does not report transparent frames as corrupted", () => {
    const analysis = analyzeFrame(frame(), {});

    expect(analysis.components).toEqual([]);
    expect(analysis.suspiciousComponents).toEqual([]);
  });
});
