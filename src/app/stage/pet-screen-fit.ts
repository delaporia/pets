import type { LoadedPet } from "../pets/pet-loader";
import type { WorkArea } from "../runtime/pet-context";
import type { StageEntity } from "./entity";
import type { Point } from "./geometry";

export const PET_VIEWPORT_PADDING = 28;

function clampAxis(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (minimum <= maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }
  return (minimum + maximum) / 2;
}

export function fittedPetScale(
  pet: LoadedPet,
  requestedScale: number,
  workArea: WorkArea,
  padding = PET_VIEWPORT_PADDING,
): number {
  const idleId = pet.manifest.capabilities.idle;
  const idle = pet.manifest.animations[idleId];
  const atlas = idle ? pet.manifest.atlases[idle.atlas] : undefined;
  if (!idle || !atlas) {
    throw new Error("Pet idle atlas is unavailable");
  }
  const visual = pet.manifest.display.visualBounds ?? {
    left: 0,
    top: 0,
    right: atlas.cellWidth,
    bottom: atlas.cellHeight,
  };
  const visualWidth =
    (visual.right - visual.left) * pet.manifest.display.scale;
  const visualHeight =
    (visual.bottom - visual.top) * pet.manifest.display.scale;
  const availableWidth = Math.max(1, workArea.width - padding * 2);
  const availableHeight = Math.max(1, workArea.height - padding * 2);
  const maximumScale = Math.min(
    availableWidth / visualWidth,
    availableHeight / visualHeight,
  );
  return Math.max(0.01, Math.min(requestedScale, maximumScale));
}

export function clampEntityPositionToWorkArea(
  entity: StageEntity,
  workArea: WorkArea,
  requested: Point = entity.transform.position,
): Point {
  const bounds = entity.localBounds;
  if (!bounds) return { ...requested };

  const { scale, rotation } = entity.transform;
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
      x: scaledX * cosine - scaledY * sine,
      y: scaledX * sine + scaledY * cosine,
    };
  });
  const minimumOffsetX = Math.min(...corners.map(({ x }) => x));
  const maximumOffsetX = Math.max(...corners.map(({ x }) => x));
  const minimumOffsetY = Math.min(...corners.map(({ y }) => y));
  const maximumOffsetY = Math.max(...corners.map(({ y }) => y));

  return {
    x: clampAxis(
      requested.x,
      workArea.x - minimumOffsetX,
      workArea.x + workArea.width - maximumOffsetX,
    ),
    y: clampAxis(
      requested.y,
      workArea.y - minimumOffsetY,
      workArea.y + workArea.height - maximumOffsetY,
    ),
  };
}
