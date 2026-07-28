import type {
  Point,
  Size,
  WorkArea,
} from "../runtime/pet-context";
import { interactionSurfaceLayout } from "./interaction-surface-layout";

interface SurfaceContext {
  position: Point;
  windowSize: Size;
  workArea: WorkArea;
  interactionActive?: boolean;
}

export class InteractionSurfaceController {
  private active = false;
  private origin: Point = { x: 0, y: 0 };
  private status: Point = { x: 0, y: 0 };

  constructor(
    private readonly root: HTMLElement,
    private readonly renderer: {
      setViewport(
        width: number,
        height: number,
        origin: Point,
      ): void;
    },
    private readonly native: {
      resize(width: number, height: number): Promise<void>;
      move(x: number, y: number): Promise<void>;
      lockInteraction(locked: boolean): Promise<void>;
    },
  ) {}

  get isOpen(): boolean {
    return this.active;
  }

  get petOrigin(): Point {
    return { ...this.origin };
  }

  get statusOrigin(): Point {
    return { ...this.status };
  }

  async open(context: SurfaceContext): Promise<void> {
    const placement = interactionSurfaceLayout(
      context.position,
      context.windowSize,
      context.workArea,
    );
    this.active = true;
    context.interactionActive = true;
    this.origin = { ...placement.petOrigin };
    this.status = { ...placement.statusOrigin };
    this.root.dataset.side = placement.side;
    this.root.style.setProperty(
      "--pet-origin-x",
      `${placement.petOrigin.x}px`,
    );
    this.root.style.setProperty(
      "--pet-origin-y",
      `${placement.petOrigin.y}px`,
    );
    this.root.style.setProperty(
      "--pet-width",
      `${context.windowSize.width}px`,
    );
    this.root.style.setProperty(
      "--pet-height",
      `${context.windowSize.height}px`,
    );
    this.root.style.setProperty(
      "--pet-center-y",
      `${placement.petOrigin.y + context.windowSize.height / 2}px`,
    );
    this.renderer.setViewport(
      placement.windowSize.width,
      placement.windowSize.height,
      placement.petOrigin,
    );
    await this.native.lockInteraction(true);
    await this.native.resize(
      placement.windowSize.width,
      placement.windowSize.height,
    );
    await this.native.move(
      placement.windowPosition.x,
      placement.windowPosition.y,
    );
  }

  async close(context: SurfaceContext): Promise<void> {
    if (!this.active) return;
    this.active = false;
    context.interactionActive = false;
    this.origin = { x: 0, y: 0 };
    this.status = { x: 0, y: 0 };
    this.renderer.setViewport(
      context.windowSize.width,
      context.windowSize.height,
      { x: 0, y: 0 },
    );
    await this.native.resize(
      context.windowSize.width,
      context.windowSize.height,
    );
    await this.native.move(context.position.x, context.position.y);
    await this.native.lockInteraction(false);
    delete this.root.dataset.side;
    this.root.style.removeProperty("--pet-origin-x");
    this.root.style.removeProperty("--pet-origin-y");
    this.root.style.removeProperty("--pet-width");
    this.root.style.removeProperty("--pet-height");
    this.root.style.removeProperty("--pet-center-y");
  }
}
