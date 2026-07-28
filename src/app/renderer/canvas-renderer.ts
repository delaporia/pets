import type { RenderFrame } from "../animation/animation-player";

export class CanvasRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly cellCanvas: HTMLCanvasElement;
  private readonly cellContext: CanvasRenderingContext2D;
  private petOrigin = { x: 0, y: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly petWidth: number,
    private readonly petHeight: number,
    createCanvas: () => HTMLCanvasElement = () =>
      document.createElement("canvas"),
  ) {
    this.canvas.width = petWidth;
    this.canvas.height = petHeight;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Canvas 2D context is unavailable");
    }
    this.context = context;

    this.cellCanvas = createCanvas();
    const cellContext = this.cellCanvas.getContext("2d");
    if (!cellContext) {
      throw new Error("Cell canvas 2D context is unavailable");
    }
    this.cellContext = cellContext;
  }

  setViewport(
    width: number,
    height: number,
    petOrigin: { x: number; y: number } = { x: 0, y: 0 },
  ): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.petOrigin = { ...petOrigin };
  }

  draw(frame: RenderFrame): ImageData {
    const { width, height } = this.canvas;
    if (
      this.cellCanvas.width !== frame.cellWidth ||
      this.cellCanvas.height !== frame.cellHeight
    ) {
      this.cellCanvas.width = frame.cellWidth;
      this.cellCanvas.height = frame.cellHeight;
    }
    this.cellContext.clearRect(0, 0, frame.cellWidth, frame.cellHeight);
    this.cellContext.drawImage(
      frame.image,
      frame.column * frame.cellWidth,
      frame.row * frame.cellHeight,
      frame.cellWidth,
      frame.cellHeight,
      0,
      0,
      frame.cellWidth,
      frame.cellHeight,
    );

    this.context.clearRect(0, 0, width, height);
    this.context.drawImage(
      this.cellCanvas,
      this.petOrigin.x,
      this.petOrigin.y,
      this.petWidth,
      this.petHeight,
    );
    return this.context.getImageData(0, 0, width, height);
  }
}
