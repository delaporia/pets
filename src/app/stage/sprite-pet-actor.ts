import { frameAt } from "../animation/animation-clock";
import type { LoadedPet } from "../pets/pet-loader";
import type {
  EntityAnimationState,
  StageEntity,
} from "./entity";
import type { Point } from "./geometry";

export interface SpriteFrame {
  image: HTMLImageElement;
  atlasId: string;
  row: number;
  column: number;
  cellWidth: number;
  cellHeight: number;
}

export function createSpritePetActor(
  pet: LoadedPet,
  footPosition: Point,
  petScale: number,
): StageEntity {
  const idleClip = pet.manifest.capabilities.idle;
  const idle = pet.manifest.animations[idleClip];
  if (!idle) {
    throw new Error("Pet has no idle animation");
  }
  const atlas = pet.manifest.atlases[idle.atlas];
  if (!atlas) {
    throw new Error(`Atlas "${idle.atlas}" is unavailable`);
  }
  const scale = pet.manifest.display.scale * petScale;
  const foot = pet.manifest.display.footAnchor ?? {
    x: atlas.cellWidth / 2,
    y: atlas.cellHeight,
  };
  const visual = pet.manifest.display.visualBounds ?? {
    left: 0,
    top: 0,
    right: atlas.cellWidth,
    bottom: atlas.cellHeight,
  };
  return {
    id: pet.manifest.id,
    kind: "pet",
    layer: 20,
    transient: false,
    visible: true,
    visual: "pet-sprite",
    localBounds: {
      x: (visual.left - foot.x) * scale,
      y: (visual.top - foot.y) * scale,
      width: (visual.right - visual.left) * scale,
      height: (visual.bottom - visual.top) * scale,
    },
    anchors: {
      foot: { x: 0, y: 0 },
      body: {
        x: 0,
        y: ((visual.top + visual.bottom) / 2 - foot.y) * scale,
      },
      look: {
        x: 0,
        y: (visual.top - foot.y + 46) * scale,
      },
    },
    transform: {
      position: { ...footPosition },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
    animation: {
      clip: idleClip,
      loop: true,
      elapsedMs: 0,
    },
  };
}

export function spriteFrameFor(
  pet: LoadedPet,
  state: EntityAnimationState,
): SpriteFrame {
  const resolvedClip =
    pet.manifest.capabilities[state.clip] ?? state.clip;
  const animation = pet.manifest.animations[resolvedClip];
  if (!animation) {
    throw new Error(`Unknown sprite animation "${state.clip}"`);
  }
  const atlas = pet.manifest.atlases[animation.atlas];
  const image = pet.images.get(animation.atlas);
  if (!atlas || !image) {
    throw new Error(`Atlas "${animation.atlas}" is not loaded`);
  }
  const index = frameAt(
    Math.max(0, state.elapsedMs),
    animation.fps,
    animation.frames.length,
    state.loop && animation.loop,
  );
  const column = animation.frames[index];
  if (column === undefined) {
    throw new Error(
      `Animation "${resolvedClip}" has no frame at ${index}`,
    );
  }
  return {
    image,
    atlasId: animation.atlas,
    row: animation.row,
    column,
    cellWidth: atlas.cellWidth,
    cellHeight: atlas.cellHeight,
  };
}

export function spriteFrameForGaze(
  pet: LoadedPet,
  directionIndex: number,
): SpriteFrame {
  const normalized =
    ((Math.round(directionIndex) % 16) + 16) % 16;
  const capability =
    normalized < 8 ? "lookUpper" : "lookLower";
  const animationId =
    pet.manifest.capabilities[capability] ?? capability;
  const animation = pet.manifest.animations[animationId];
  if (!animation) {
    throw new Error(`Unknown sprite animation "${animationId}"`);
  }
  const atlas = pet.manifest.atlases[animation.atlas];
  const image = pet.images.get(animation.atlas);
  if (!atlas || !image) {
    throw new Error(`Atlas "${animation.atlas}" is not loaded`);
  }
  const frameIndex = normalized < 8 ? normalized : normalized - 8;
  const column = animation.frames[
    Math.min(frameIndex, animation.frames.length - 1)
  ];
  if (column === undefined) {
    throw new Error(`Animation "${animationId}" has no gaze frame`);
  }
  return {
    image,
    atlasId: animation.atlas,
    row: animation.row,
    column,
    cellWidth: atlas.cellWidth,
    cellHeight: atlas.cellHeight,
  };
}
