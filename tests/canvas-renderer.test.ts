import { describe, expect, it, vi } from "vitest";

import { CanvasRenderer } from "../src/app/renderer/canvas-renderer";
import type { RenderFrame } from "../src/app/animation/animation-player";

describe("CanvasRenderer", () => {
  it("copies the requested atlas cell at native size before scaling it", () => {
    const canvas = document.createElement("canvas");
    const cellCanvas = document.createElement("canvas");
    const imageData = {
      data: new Uint8ClampedArray(192 * 208 * 4),
      width: 192,
      height: 208,
    } as ImageData;
    const outputContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
      imageSmoothingEnabled: true,
    };
    const cellContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: true,
    };
    vi.spyOn(canvas, "getContext").mockReturnValue(
      outputContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(cellCanvas, "getContext").mockReturnValue(
      cellContext as unknown as CanvasRenderingContext2D,
    );
    const renderer = new CanvasRenderer(canvas, 192, 208, () => cellCanvas);
    const image = {} as HTMLImageElement;
    const frame: RenderFrame = {
      animationId: "walkRight",
      image,
      row: 1,
      column: 3,
      cellWidth: 192,
      cellHeight: 208,
    };

    expect(renderer.draw(frame)).toBe(imageData);
    expect(cellCanvas.width).toBe(192);
    expect(cellCanvas.height).toBe(208);
    expect(cellContext.clearRect).toHaveBeenCalledWith(0, 0, 192, 208);
    expect(cellContext.drawImage).toHaveBeenCalledWith(
      image,
      576,
      208,
      192,
      208,
      0,
      0,
      192,
      208,
    );
    expect(outputContext.clearRect).toHaveBeenCalledWith(0, 0, 192, 208);
    expect(outputContext.drawImage).toHaveBeenCalledWith(
      cellCanvas,
      0,
      0,
      192,
      208,
    );
  });

  it("keeps the pet at its own size inside an expanded interaction surface", () => {
    const canvas = document.createElement("canvas");
    const cellCanvas = document.createElement("canvas");
    const imageData = {
      data: new Uint8ClampedArray(306 * 125 * 4),
      width: 306,
      height: 125,
    } as ImageData;
    const outputContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
    };
    const cellContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.spyOn(canvas, "getContext").mockReturnValue(
      outputContext as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(cellCanvas, "getContext").mockReturnValue(
      cellContext as unknown as CanvasRenderingContext2D,
    );
    const renderer = new CanvasRenderer(canvas, 116, 125, () => cellCanvas);
    renderer.setViewport(306, 125, { x: 190, y: 0 });

    renderer.draw({
      animationId: "idle",
      image: {} as HTMLImageElement,
      row: 0,
      column: 0,
      cellWidth: 192,
      cellHeight: 208,
    });

    expect(canvas.width).toBe(306);
    expect(canvas.height).toBe(125);
    expect(outputContext.clearRect).toHaveBeenCalledWith(0, 0, 306, 125);
    expect(outputContext.drawImage).toHaveBeenCalledWith(
      cellCanvas,
      190,
      0,
      116,
      125,
    );
    expect(outputContext.getImageData).toHaveBeenCalledWith(0, 0, 306, 125);
  });
});
