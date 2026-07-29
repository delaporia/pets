import type { ActorAnchors, Point, Rect } from "./geometry";

export type EntityKind = "pet" | "prop" | "effect" | "shadow";

export interface EntityTransform {
  position: Point;
  scale: Point;
  rotation: number;
  alpha: number;
}

export interface EntityAnimationState {
  clip: string;
  loop: boolean;
  elapsedMs: number;
}

export interface StageEntity {
  id: string;
  kind: EntityKind;
  layer: number;
  transient: boolean;
  visible: boolean;
  transform: EntityTransform;
  animation?: EntityAnimationState;
  gazeDirectionIndex?: number;
  visual?: string;
  anchors?: ActorAnchors;
  localBounds?: Rect;
}
