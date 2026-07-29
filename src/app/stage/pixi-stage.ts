import type { HitMaskPayload } from "../native/native-window";
import type { EntityKind, StageEntity } from "./entity";
import type { EntityTransform } from "./entity";
import type { Rect } from "./geometry";

export interface StageDisplaySnapshot {
  id: string;
  kind: EntityKind;
  visual?: string;
  visible: boolean;
  transform: EntityTransform;
  animation?: StageEntity["animation"];
  gazeDirectionIndex?: number;
}

export interface PixiStageBackend {
  initialize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): Promise<void>;
  resize(width: number, height: number): void;
  sync(snapshots: readonly StageDisplaySnapshot[]): void;
  render(): void;
  readPixels(): Uint8ClampedArray;
  destroy(): void;
}

export interface PixiStageOptions {
  width: number;
  height: number;
  alphaThreshold?: number;
  backend: PixiStageBackend;
}

export class PixiStage {
  private viewport: Rect;
  private destroyed = false;

  private constructor(
    private readonly backend: PixiStageBackend,
    width: number,
    height: number,
    private readonly alphaThreshold: number,
  ) {
    this.viewport = { x: 0, y: 0, width, height };
  }

  static async create(
    canvas: HTMLCanvasElement,
    options: PixiStageOptions,
  ): Promise<PixiStage> {
    if (options.width <= 0 || options.height <= 0) {
      throw new Error("Stage dimensions must be positive");
    }
    const threshold = options.alphaThreshold ?? 128;
    if (threshold < 0 || threshold > 255) {
      throw new Error("Alpha threshold must be between 0 and 255");
    }
    const backend = options.backend;
    await backend.initialize(canvas, options.width, options.height);
    return new PixiStage(
      backend,
      options.width,
      options.height,
      threshold,
    );
  }

  setViewport(viewport: Rect): void {
    if (viewport.width <= 0 || viewport.height <= 0) {
      throw new Error("Stage viewport must have positive dimensions");
    }
    const sizeChanged =
      viewport.width !== this.viewport.width ||
      viewport.height !== this.viewport.height;
    this.viewport = { ...viewport };
    if (sizeChanged) {
      this.backend.resize(viewport.width, viewport.height);
    }
  }

  sync(entities: readonly StageEntity[]): void {
    const snapshots = entities
      .map((entity, insertionOrder) => ({ entity, insertionOrder }))
      .sort(
        (left, right) =>
          left.entity.layer - right.entity.layer ||
          left.insertionOrder - right.insertionOrder,
      )
      .map(({ entity }): StageDisplaySnapshot => ({
        id: entity.id,
        kind: entity.kind,
        visual: entity.visual,
        visible: entity.visible,
        transform: {
          position: {
            x: entity.transform.position.x - this.viewport.x,
            y: entity.transform.position.y - this.viewport.y,
          },
          scale: { ...entity.transform.scale },
          rotation: entity.transform.rotation,
          alpha: entity.transform.alpha,
        },
        animation: entity.animation
          ? { ...entity.animation }
          : undefined,
        gazeDirectionIndex: entity.gazeDirectionIndex,
      }));
    this.backend.sync(snapshots);
  }

  render(): void {
    this.backend.render();
  }

  readAlphaMask(): HitMaskPayload {
    const rgba = this.backend.readPixels();
    const pixelCount = this.viewport.width * this.viewport.height;
    if (rgba.length !== pixelCount * 4) {
      throw new Error(
        `Renderer returned ${rgba.length} bytes for ${pixelCount} pixels`,
      );
    }
    const pixels = new Array<number>(pixelCount);
    for (let index = 0; index < pixelCount; index += 1) {
      pixels[index] =
        rgba[index * 4 + 3]! >= this.alphaThreshold ? 255 : 0;
    }
    return {
      width: this.viewport.width,
      height: this.viewport.height,
      threshold: this.alphaThreshold,
      pixels,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.backend.destroy();
  }
}
