import type { RenderFrame } from "../animation/animation-player";
import { AlphaMask } from "../renderer/alpha-mask";
import {
  clampActivityAnchor,
  clampPosition,
  type PetContext,
  type WorkArea,
} from "./pet-context";
import type { HitMaskPayload } from "../native/native-window";
import type { PersonalityMode } from "../personality/profiles";
import type { CursorProximityState } from "../interactions/cursor-proximity";

interface RuntimeMachine {
  readonly activeId?: string;
  update(deltaMs: number): void;
  request(id: string): boolean;
}

interface RuntimePlayer {
  update(deltaMs: number): RenderFrame;
}

interface RuntimeRenderer {
  draw(frame: RenderFrame): ImageData;
}

interface RuntimeNative {
  move(x: number, y: number): Promise<void>;
  updateHitMask(mask: HitMaskPayload): Promise<void>;
  setVisible(visible: boolean): Promise<void>;
}

interface RuntimeCursor {
  update(state: CursorProximityState): Promise<boolean>;
}

export interface PetRuntimeDependencies {
  context: PetContext;
  machine: RuntimeMachine;
  player: RuntimePlayer;
  renderer: RuntimeRenderer;
  native: RuntimeNative;
  cursor?: RuntimeCursor;
  showcase?: {
    start(): void;
    stop(): void;
    update(deltaMs: number): void;
  };
}

export class PetRuntime {
  private animationFrame: number | undefined;
  private previousTimestamp: number | undefined;
  private lastFrameKey: string | undefined;
  private lastPosition: { x: number; y: number } | undefined;
  private showcaseActive = false;

  constructor(private readonly dependencies: PetRuntimeDependencies) {}

  start(): void {
    if (this.animationFrame !== undefined) return;
    const tick = async (timestamp: number): Promise<void> => {
      const delta =
        this.previousTimestamp === undefined
          ? 0
          : timestamp - this.previousTimestamp;
      this.previousTimestamp = timestamp;
      try {
        await this.update(delta);
      } catch (error) {
        console.error("Pet runtime frame failed", error);
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
    const { context, machine, player, renderer, native, cursor, showcase } =
      this.dependencies;
    context.elapsedMs += delta;
    if (
      context.personalityMode === "test" &&
      !context.paused &&
      showcase
    ) {
      if (!this.showcaseActive) {
        showcase.start();
        this.showcaseActive = true;
      }
      showcase.update(delta);
    } else {
      if (this.showcaseActive) {
        showcase?.stop();
        this.showcaseActive = false;
        machine.request("idle");
      }
      machine.update(delta);
    }
    await cursor?.update({
      nowMs: context.elapsedMs,
      position: { ...context.position },
      windowSize: { ...context.windowSize },
      visualBounds: context.visualBounds
        ? { ...context.visualBounds }
        : undefined,
      dragging: context.drag.active,
      interactionActive: context.interactionActive,
      activeBehaviorId: machine.activeId,
      personalityMode: context.personalityMode,
    });
    const frame = player.update(delta);
    const frameKey = `${frame.animationId}:${frame.row}:${frame.column}`;
    if (frameKey !== this.lastFrameKey) {
      const imageData = renderer.draw(frame);
      const mask = AlphaMask.fromImageData(imageData, 128);
      await native.updateHitMask(mask.toPayload());
      this.lastFrameKey = frameKey;
    }
    if (
      !this.lastPosition ||
      context.position.x !== this.lastPosition.x ||
      context.position.y !== this.lastPosition.y
    ) {
      await native.move(context.position.x, context.position.y);
      this.lastPosition = { ...context.position };
    }
  }

  invalidateRender(): void {
    this.lastFrameKey = undefined;
  }

  setPaused(paused: boolean): void {
    this.dependencies.context.paused = paused;
    if (paused) {
      this.dependencies.machine.request("idle");
    }
  }

  async setVisible(visible: boolean): Promise<void> {
    await this.dependencies.native.setVisible(visible);
  }

  setPersonality(mode: PersonalityMode): void {
    this.dependencies.context.personalityMode = mode;
    this.dependencies.machine.request("idle");
  }

  setWorkArea(workArea: WorkArea): void {
    const context = this.dependencies.context;
    context.workArea = workArea;
    context.position = clampPosition(context, context.position);
    clampActivityAnchor(context);
    if (context.activityAnchor) {
      context.position.y = context.activityAnchor.y;
    }
  }
}
