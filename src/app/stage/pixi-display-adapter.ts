import "pixi.js/unsafe-eval";
import {
  Application,
  Container,
  Graphics,
  Rectangle,
} from "pixi.js";

import { butterflyWingScale } from "./butterfly-actor";
import type {
  PixiStageBackend,
  StageDisplaySnapshot,
} from "./pixi-stage";

export type PixiViewFactory = (
  snapshot: StageDisplaySnapshot,
) => Container;

export interface SnapshotView extends Container {
  syncStageSnapshot?(
    snapshot: StageDisplaySnapshot,
  ): void;
}

class ButterflyView extends Container {
  private readonly leftWing: Graphics;
  private readonly rightWing: Graphics;

  constructor() {
    super();
    this.leftWing = new Graphics()
      .ellipse(-8, 0, 12, 17)
      .fill({ color: 0xffb7dc, alpha: 0.92 })
      .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    this.rightWing = new Graphics()
      .ellipse(8, 0, 12, 17)
      .fill({ color: 0xb9d8ff, alpha: 0.92 })
      .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    const body = new Graphics()
      .ellipse(0, 1, 3.5, 10)
      .fill({ color: 0x7f5a83 })
      .moveTo(-1, -8)
      .bezierCurveTo(-7, -16, -10, -13, -11, -18)
      .stroke({ color: 0x7f5a83, width: 1.5 })
      .moveTo(1, -8)
      .bezierCurveTo(7, -16, 10, -13, 11, -18)
      .stroke({ color: 0x7f5a83, width: 1.5 });
    this.addChild(this.leftWing, this.rightWing, body);
  }

  syncStageSnapshot(snapshot: StageDisplaySnapshot): void {
    const wingScale = butterflyWingScale(
      snapshot.animation?.elapsedMs ?? 0,
    );
    this.leftWing.scale.x = wingScale;
    this.rightWing.scale.x = wingScale;
  }
}

function createTreatStickView(): Container {
  const view = new Container();
  const tube = new Graphics()
    .roundRect(-52, -11, 82, 22, 9)
    .fill({ color: 0xffb6cc })
    .stroke({ color: 0x8e5b72, width: 2 })
    .roundRect(-42, -7, 38, 14, 6)
    .fill({ color: 0xfff5e8 })
    .circle(-23, 0, 5)
    .fill({ color: 0xe992ae })
    .moveTo(-49, -8)
    .lineTo(-58, -4)
    .lineTo(-58, 4)
    .lineTo(-49, 8)
    .fill({ color: 0xf48cab });
  const nozzle = new Graphics()
    .roundRect(29, -6, 18, 12, 4)
    .fill({ color: 0xfff0d9 })
    .stroke({ color: 0x8e5b72, width: 2 })
    .roundRect(45, -3, 9, 6, 3)
    .fill({ color: 0xc98a6b });
  const fish = new Graphics()
    .ellipse(-23, 0, 7, 4)
    .fill({ color: 0xf6ac7e })
    .moveTo(-29, 0)
    .lineTo(-36, -5)
    .lineTo(-36, 5)
    .closePath()
    .fill({ color: 0xf6ac7e });
  view.addChild(tube, nozzle, fish);
  return view;
}

function createTreatDishView(): Container {
  const view = new Container();
  const shadow = new Graphics()
    .ellipse(0, 8, 46, 9)
    .fill({ color: 0x3d3247, alpha: 0.18 });
  const dish = new Graphics()
    .ellipse(0, 2, 44, 13)
    .fill({ color: 0xfffbf3 })
    .stroke({ color: 0xd8a8b8, width: 2.5 })
    .ellipse(0, 0, 31, 7.5)
    .fill({ color: 0xffd9b8 })
    .stroke({ color: 0xe7ad91, width: 1.5 });
  const paw = new Graphics()
    .circle(0, 0, 3.2)
    .circle(-5, -3, 1.8)
    .circle(0, -5, 1.8)
    .circle(5, -3, 1.8)
    .fill({ color: 0xf29db2, alpha: 0.72 });
  view.addChild(shadow, dish, paw);
  return view;
}

function createTreatSparkleView(): Container {
  const view = new Container();
  for (const [x, y, radius] of [
    [-15, -12, 3],
    [10, -18, 2.5],
    [17, 7, 2],
    [-12, 13, 2],
  ] as const) {
    view.addChild(
      new Graphics()
        .moveTo(x, y - radius * 2)
        .lineTo(x + radius, y - radius)
        .lineTo(x + radius * 2, y)
        .lineTo(x + radius, y + radius)
        .lineTo(x, y + radius * 2)
        .lineTo(x - radius, y + radius)
        .lineTo(x - radius * 2, y)
        .lineTo(x - radius, y - radius)
        .closePath()
        .fill({ color: 0xffe783, alpha: 0.9 }),
    );
  }
  return view;
}

function createBondHeartView(): Container {
  const view = new Container();
  const heart = (
    x: number,
    y: number,
    scale: number,
    color: number,
  ) =>
    new Graphics()
      .moveTo(x, y + 9 * scale)
      .bezierCurveTo(
        x - 18 * scale,
        y - 2 * scale,
        x - 12 * scale,
        y - 18 * scale,
        x,
        y - 9 * scale,
      )
      .bezierCurveTo(
        x + 12 * scale,
        y - 18 * scale,
        x + 18 * scale,
        y - 2 * scale,
        x,
        y + 9 * scale,
      )
      .fill({ color, alpha: 0.92 })
      .stroke({ color: 0xffffff, width: 2.2 });
  view.addChild(
    heart(0, 3, 1, 0xf0809a),
    heart(-27, 20, 0.55, 0xffb0c1),
    heart(28, 16, 0.48, 0xf6bd72),
  );
  return view;
}

export function createDefaultPixiView(
  snapshot: StageDisplaySnapshot,
): SnapshotView {
  switch (snapshot.visual) {
    case "butterfly":
      return new ButterflyView();
    case "butterfly-trail": {
      const trail = new Container();
      for (const [x, y, radius, alpha] of [
        [-8, 4, 3, 0.5],
        [-18, 10, 2.2, 0.34],
        [-28, 15, 1.5, 0.2],
      ] as const) {
        trail.addChild(
          new Graphics()
            .circle(x, y, radius)
            .fill({ color: 0xfff2a8, alpha }),
        );
      }
      return trail;
    }
    case "pet-shadow":
      return new Graphics()
        .ellipse(0, 0, 68, 12)
        .fill({ color: 0x2a2640, alpha: 0.28 });
    case "treat-stick":
      return createTreatStickView();
    case "treat-dish":
      return createTreatDishView();
    case "treat-sparkle":
      return createTreatSparkleView();
    case "bond-heart":
      return createBondHeartView();
    default:
      return new Container();
  }
}

export class PixiDisplayBackend implements PixiStageBackend {
  private readonly application = new Application();
  private readonly views = new Map<string, Container>();
  private initialized = false;
  private width = 1;
  private height = 1;

  constructor(
    private readonly createView: PixiViewFactory =
      createDefaultPixiView,
  ) {}

  async initialize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): Promise<void> {
    await this.application.init({
      canvas,
      width,
      height,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: false,
      resolution: 1,
      autoStart: false,
      sharedTicker: false,
      preference: "webgl",
    });
    this.width = width;
    this.height = height;
    this.initialized = true;
  }

  resize(width: number, height: number): void {
    this.assertInitialized();
    this.width = width;
    this.height = height;
    this.application.renderer.resize(width, height);
  }

  sync(snapshots: readonly StageDisplaySnapshot[]): void {
    this.assertInitialized();
    const activeIds = new Set(snapshots.map(({ id }) => id));
    for (const [id, view] of this.views) {
      if (!activeIds.has(id)) {
        this.application.stage.removeChild(view);
        view.destroy({ children: true });
        this.views.delete(id);
      }
    }

    const orderedViews = snapshots.map((snapshot) => {
      let view = this.views.get(snapshot.id);
      if (!view) {
        view = this.createView(snapshot);
        this.views.set(snapshot.id, view);
      }
      const { transform } = snapshot;
      view.position.set(
        transform.position.x,
        transform.position.y,
      );
      view.scale.set(transform.scale.x, transform.scale.y);
      view.rotation = transform.rotation;
      view.alpha = transform.alpha;
      view.visible = snapshot.visible;
      (view as SnapshotView).syncStageSnapshot?.(snapshot);
      return view;
    });
    this.application.stage.removeChildren();
    this.application.stage.addChild(...orderedViews);
  }

  render(): void {
    this.assertInitialized();
    this.application.render();
  }

  readPixels(): Uint8ClampedArray {
    this.assertInitialized();
    return this.application.renderer.extract.pixels({
      target: this.application.stage,
      frame: new Rectangle(0, 0, this.width, this.height),
    }).pixels;
  }

  destroy(): void {
    if (!this.initialized) return;
    this.views.clear();
    this.application.destroy(
      { removeView: false },
      { children: true },
    );
    this.initialized = false;
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error("Pixi display backend is not initialized");
    }
  }
}
