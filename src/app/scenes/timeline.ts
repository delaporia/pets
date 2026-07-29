import type {
  EntityKind,
  EntityTransform,
} from "../stage/entity";
import type { Point, Rect } from "../stage/geometry";
import type { CubicBezierPath } from "./bezier-path";

export type TimelineEasing =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut";

export interface TransformKeyframe {
  atMs: number;
  value: EntityTransform;
  easing: TimelineEasing;
  positionPath?: CubicBezierPath;
}

export interface TransformTrack {
  entityId: string;
  keyframes: TransformKeyframe[];
}

export interface AnimationKeyframe {
  atMs: number;
  clip: string;
  loop: boolean;
}

export interface AnimationTrack {
  entityId: string;
  keyframes: AnimationKeyframe[];
}

export interface SceneEvent {
  id: string;
  atMs: number;
  payload?: Readonly<Record<string, unknown>>;
}

export interface SceneEntityDeclaration {
  id: string;
  kind: EntityKind;
  layer: number;
  visual: string;
  localBounds?: Rect;
}

export interface SceneSettlement {
  petEntityId: string;
  petPosition: Point;
}

export interface SceneDefinition {
  id: string;
  durationMs: number;
  boundsPadding: number;
  entities: SceneEntityDeclaration[];
  transformTracks: TransformTrack[];
  animationTracks: AnimationTrack[];
  events: SceneEvent[];
  settlement: SceneSettlement;
}
