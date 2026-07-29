import type { HitMaskPayload } from "../native/native-window";
import type { PersonalityMode } from "../personality/profiles";
import type { StageEntity } from "../stage/entity";
import { EntityRegistry } from "../stage/entity-registry";
import type { Rect } from "../stage/geometry";
import { WorldCoordinateSystem } from "../stage/world-coordinate-system";

interface RuntimeSceneDirector {
  update(deltaMs: number): void;
}

interface RuntimeStage {
  setViewport(viewport: Rect): void;
  sync(entities: readonly StageEntity[]): void;
  render(): void;
  readAlphaMask(): HitMaskPayload;
  destroy(): void;
}

interface RuntimeNativeWindow {
  resizeAndMove(bounds: Rect): Promise<void>;
  updateHitMask(mask: HitMaskPayload): Promise<void>;
  setVisible(visible: boolean): Promise<void>;
}

export interface StageRuntimeDependencies {
  registry: EntityRegistry;
  director: RuntimeSceneDirector;
  stage: RuntimeStage;
  native: RuntimeNativeWindow;
  coordinates: WorldCoordinateSystem;
  boundsPadding: number;
  hitMaskIntervalMs?: number;
  onViewportChanged?(viewport: Rect): void;
  onLayout?(viewport: Rect): void;
  onBeforeRender?(
    elapsedMs: number,
    deltaMs: number,
  ): void | Promise<void>;
  onPersonalityChanged?(mode: PersonalityMode): void;
  onPausedChanged?(paused: boolean): void;
}

function sameRect(left: Rect | undefined, right: Rect): boolean {
  return (
    left?.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function transformedBounds(entity: StageEntity): Rect | undefined {
  const bounds = entity.localBounds;
  if (!bounds || !entity.visible || entity.transform.alpha <= 0) {
    return undefined;
  }
  const { position, scale, rotation } = entity.transform;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    {
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height,
    },
  ].map((corner) => {
    const scaledX = corner.x * scale.x;
    const scaledY = corner.y * scale.y;
    return {
      x: position.x + scaledX * cosine - scaledY * sine,
      y: position.y + scaledX * sine + scaledY * cosine,
    };
  });
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

function contentBounds(entities: readonly StageEntity[]): Rect {
  const bounds = entities
    .map(transformedBounds)
    .filter((value): value is Rect => value !== undefined);
  if (bounds.length === 0) {
    throw new Error("Stage has no visible entity bounds");
  }
  const minimumX = Math.min(...bounds.map(({ x }) => x));
  const minimumY = Math.min(...bounds.map(({ y }) => y));
  const maximumX = Math.max(
    ...bounds.map(({ x, width }) => x + width),
  );
  const maximumY = Math.max(
    ...bounds.map(({ y, height }) => y + height),
  );
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX,
    height: maximumY - minimumY,
  };
}

export class StageRuntime {
  private animationFrame: number | undefined;
  private previousTimestamp: number | undefined;
  private lastViewport: Rect | undefined;
  private hitMaskDirty = true;
  private elapsedSinceHitMaskMs = 0;
  private readonly hitMaskIntervalMs: number;
  private paused = false;
  private elapsedMs = 0;

  constructor(
    private readonly dependencies: StageRuntimeDependencies,
  ) {
    this.hitMaskIntervalMs =
      dependencies.hitMaskIntervalMs ?? 100;
  }

  start(): void {
    if (this.animationFrame !== undefined) return;
    const tick = async (timestamp: number): Promise<void> => {
      const deltaMs =
        this.previousTimestamp === undefined
          ? 0
          : timestamp - this.previousTimestamp;
      this.previousTimestamp = timestamp;
      try {
        await this.update(deltaMs);
      } catch (error) {
        console.error("Stage runtime frame failed", error);
      } finally {
        if (this.animationFrame !== undefined) {
          this.animationFrame = requestAnimationFrame((next) => {
            void tick(next);
          });
        }
      }
    };
    this.animationFrame = requestAnimationFrame((timestamp) => {
      void tick(timestamp);
    });
  }

  stop(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.animationFrame = undefined;
    this.previousTimestamp = undefined;
  }

  async update(deltaMs: number): Promise<void> {
    const delta = Math.min(100, Math.max(0, deltaMs));
    this.elapsedMs += delta;
    const {
      registry,
      director,
      stage,
      native,
      coordinates,
      boundsPadding,
    } = this.dependencies;
    for (const entity of registry.ordered()) {
      if (entity.animation) {
        entity.animation.elapsedMs += delta;
      }
    }
    if (!this.paused) {
      director.update(delta);
    }
    await this.dependencies.onBeforeRender?.(this.elapsedMs, delta);
    const entities = registry.ordered();
    const viewport = coordinates.fit(
      contentBounds(entities),
      boundsPadding,
    );
    if (!sameRect(this.lastViewport, viewport)) {
      await native.resizeAndMove(viewport);
      stage.setViewport(viewport);
      this.lastViewport = { ...viewport };
      this.hitMaskDirty = true;
      this.dependencies.onViewportChanged?.(viewport);
    }
    this.dependencies.onLayout?.(viewport);
    stage.sync(entities);
    stage.render();
    this.elapsedSinceHitMaskMs += delta;
    if (
      this.hitMaskDirty ||
      this.elapsedSinceHitMaskMs >= this.hitMaskIntervalMs
    ) {
      await native.updateHitMask(stage.readAlphaMask());
      this.hitMaskDirty = false;
      this.elapsedSinceHitMaskMs = 0;
    }
  }

  invalidateHitMask(): void {
    this.hitMaskDirty = true;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.dependencies.onPausedChanged?.(paused);
  }

  setPersonality(mode: PersonalityMode): void {
    this.dependencies.onPersonalityChanged?.(mode);
  }

  async setVisible(visible: boolean): Promise<void> {
    await this.dependencies.native.setVisible(visible);
  }

  destroy(): void {
    this.stop();
    this.dependencies.stage.destroy();
  }
}
