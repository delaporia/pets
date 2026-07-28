import type {
  Point,
  Size,
  WorkArea,
} from "../runtime/pet-context";

export interface InteractionSurfacePlacement {
  side: "left" | "right";
  windowPosition: Point;
  windowSize: Size;
  petOrigin: Point;
  statusOrigin: Point;
}

export function interactionSurfaceLayout(
  petPosition: Point,
  petSize: Size,
  workArea: WorkArea,
): InteractionSurfacePlacement {
  const menuWidth = Math.min(
    160,
    Math.max(0, workArea.width - petSize.width),
  );
  const windowSize = {
    width: petSize.width + menuWidth,
    height: petSize.height + 34,
  };
  const workAreaRight = workArea.x + workArea.width;
  const windowY = Math.max(
    workArea.y,
    Math.min(
      petPosition.y,
      workArea.y + workArea.height - windowSize.height,
    ),
  );
  const windowX = Math.max(
    workArea.x,
    Math.min(petPosition.x, workAreaRight - windowSize.width),
  );
  return {
    side: "right",
    windowPosition: { x: windowX, y: windowY },
    windowSize,
    petOrigin: { x: 0, y: 0 },
    statusOrigin: { x: 0, y: petSize.height + 2 },
  };
}
