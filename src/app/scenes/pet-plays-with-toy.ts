import type { EntityTransform } from "../stage/entity";
import type { Point } from "../stage/geometry";
import type {
  AnimationKeyframe,
  SceneDefinition,
  TransformKeyframe,
} from "./timeline";

export type PetToy = "ball" | "wand";
const INTERACTION_PROP_LAYER = 120;

export interface PetPlaysWithToyOptions {
  origin: Point;
  direction: "left" | "right";
  toy: PetToy;
  petEntityId?: string;
}

function transform(
  position: Point,
  alpha = 1,
  scale: Point = { x: 1, y: 1 },
  rotation = 0,
): EntityTransform {
  return { position, scale, rotation, alpha };
}

function shifted(
  origin: Point,
  direction: number,
  horizontal: number,
  vertical = 0,
): Point {
  return {
    x: origin.x + direction * horizontal,
    y: origin.y + vertical,
  };
}

function petTransforms(
  origin: Point,
  direction: number,
): TransformKeyframe[] {
  const at = (
    time: number,
    horizontal: number,
    vertical = 0,
    scale: Point = { x: 1, y: 1 },
  ): TransformKeyframe => ({
    atMs: time,
    value: transform(
      shifted(origin, direction, horizontal, vertical),
      1,
      { x: scale.x * direction, y: scale.y },
    ),
    easing: "easeInOut",
  });
  return [
    at(0, 0),
    at(700, 0),
    at(1_500, 0, 3, { x: 1.08, y: 0.92 }),
    at(2_500, 28, -4),
    at(3_500, 55, -10, { x: 0.92, y: 1.08 }),
    at(4_500, 36, 0),
    at(5_600, 18, 0),
    at(6_800, 18, 0),
  ];
}

function toyTransforms(
  origin: Point,
  direction: number,
  toy: PetToy,
): TransformKeyframe[] {
  const point = (
    time: number,
    horizontal: number,
    vertical: number,
    alpha = 1,
    rotation = 0,
  ): TransformKeyframe => ({
    atMs: time,
    value: transform(
      shifted(origin, direction, horizontal, vertical),
      alpha,
      { x: direction, y: 1 },
      rotation * direction,
    ),
    easing: "easeInOut",
  });
  if (toy === "ball") {
    return [
      point(0, 190, -16, 0),
      point(700, 115, -16, 1, 0.4),
      point(1_500, 80, -16, 1, 1.1),
      point(2_500, 55, -20, 1, 1.8),
      point(3_500, 105, -18, 1, 3),
      point(4_500, 45, -18, 1, 4.2),
      point(5_600, 150, -16, 1, 5.4),
      point(6_800, 220, -16, 0, 6.2),
    ];
  }
  return [
    point(0, 210, -165, 0, -0.5),
    point(700, 100, -130, 1, -0.3),
    point(1_500, 40, -105, 1, 0.1),
    point(2_500, 105, -145, 1, -0.35),
    point(3_500, 45, -75, 1, 0.25),
    point(4_500, 120, -120, 1, -0.25),
    point(5_600, 70, -95, 1, 0.1),
    point(6_800, 220, -170, 0, -0.5),
  ];
}

function petAnimations(): AnimationKeyframe[] {
  return [
    { atMs: 0, clip: "idle", loop: true },
    { atMs: 700, clip: "butterflyNotice", loop: false },
    { atMs: 1_500, clip: "butterflyCrouch", loop: false },
    { atMs: 2_500, clip: "butterflyPounce", loop: false },
    { atMs: 3_500, clip: "butterflyPounce", loop: false },
    { atMs: 4_500, clip: "butterflyLand", loop: false },
    { atMs: 5_600, clip: "idle", loop: true },
  ];
}

export function createPetPlaysWithToyScene(
  options: PetPlaysWithToyOptions,
): SceneDefinition {
  const petEntityId = options.petEntityId ?? "pet";
  const direction = options.direction === "right" ? 1 : -1;
  const propId = options.toy === "ball" ? "toy-ball" : "toy-wand";
  const petFrames = petTransforms(options.origin, direction);
  return {
    id: `${petEntityId}-plays-${options.toy}-${options.direction}`,
    durationMs: 6_800,
    boundsPadding: 32,
    entities: [
      {
        id: "pet-play-shadow",
        kind: "shadow",
        layer: 0,
        visual: "pet-shadow",
        localBounds: { x: -68, y: -12, width: 136, height: 24 },
      },
      {
        id: propId,
        kind: "prop",
        layer: INTERACTION_PROP_LAYER,
        visual: propId,
        localBounds:
          options.toy === "ball"
            ? { x: -24, y: -24, width: 48, height: 48 }
            : { x: -28, y: -95, width: 96, height: 125 },
      },
    ],
    transformTracks: [
      { entityId: petEntityId, keyframes: petFrames },
      {
        entityId: "pet-play-shadow",
        keyframes: petFrames.map((frame) => ({
          ...frame,
          value: transform(
            { x: frame.value.position.x, y: options.origin.y + 2 },
            0.45,
          ),
        })),
      },
      {
        entityId: propId,
        keyframes: toyTransforms(
          options.origin,
          direction,
          options.toy,
        ),
      },
    ],
    animationTracks: [
      {
        entityId: petEntityId,
        keyframes: petAnimations(),
      },
    ],
    events: [
      { id: `${options.toy}-enter`, atMs: 0 },
      { id: "notice", atMs: 700 },
      { id: "prepare", atMs: 1_500 },
      { id: "first-play", atMs: 2_500 },
      { id: "second-play", atMs: 3_500 },
      { id: "settle", atMs: 5_600 },
      { id: `${options.toy}-exit`, atMs: 6_800 },
    ],
    settlement: {
      petEntityId,
      petPosition: shifted(options.origin, direction, 18),
    },
  };
}
