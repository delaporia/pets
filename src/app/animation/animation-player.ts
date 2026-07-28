import type { LoadedPet } from "../pets/pet-loader";
import { frameAt } from "./animation-clock";

export interface RenderFrame {
  animationId: string;
  image: HTMLImageElement;
  row: number;
  column: number;
  cellWidth: number;
  cellHeight: number;
}

export class AnimationPlayer {
  private animationId: string | undefined;
  private elapsedMs = 0;
  private gaze:
    | {
        animationId: string;
        frameIndex: number;
      }
    | undefined;

  constructor(private readonly pet: LoadedPet) {}

  play(id: string, restart = false): void {
    this.gaze = undefined;
    const resolvedId = this.pet.manifest.capabilities[id] ?? id;
    if (!this.pet.manifest.animations[resolvedId]) {
      throw new Error(`Unknown animation "${id}"`);
    }
    if (this.animationId !== resolvedId || restart) {
      this.animationId = resolvedId;
      this.elapsedMs = 0;
    }
  }

  look(directionIndex: number): void {
    const normalized = ((Math.round(directionIndex) % 16) + 16) % 16;
    const capability = normalized < 8 ? "lookUpper" : "lookLower";
    const animationId =
      this.pet.manifest.capabilities[capability] ?? capability;
    const animation = this.pet.manifest.animations[animationId];
    if (!animation) {
      this.gaze = undefined;
      return;
    }
    this.gaze = {
      animationId,
      frameIndex: normalized < 8 ? normalized : normalized - 8,
    };
  }

  clearLook(): void {
    this.gaze = undefined;
  }

  update(deltaMs: number): RenderFrame {
    if (!this.animationId) {
      this.play("idle");
    }
    this.elapsedMs += Math.max(0, deltaMs);

    const animationId = this.gaze?.animationId ?? this.animationId;
    if (!animationId) {
      throw new Error("Animation player has no active animation");
    }
    const animation = this.pet.manifest.animations[animationId];
    if (!animation) {
      throw new Error(`Unknown animation "${animationId}"`);
    }
    const atlas = this.pet.manifest.atlases[animation.atlas];
    const image = this.pet.images.get(animation.atlas);
    if (!atlas || !image) {
      throw new Error(`Atlas "${animation.atlas}" is not loaded`);
    }

    const index =
      this.gaze?.animationId === animationId
        ? Math.min(this.gaze.frameIndex, animation.frames.length - 1)
        : frameAt(
            this.elapsedMs,
            animation.fps,
            animation.frames.length,
            animation.loop,
          );
    const column = animation.frames[index];
    if (column === undefined) {
      throw new Error(`Animation "${animationId}" has no frame at ${index}`);
    }

    return {
      animationId,
      image,
      row: animation.row,
      column,
      cellWidth: atlas.cellWidth,
      cellHeight: atlas.cellHeight,
    };
  }
}
