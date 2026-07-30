import type { EntityTransform } from "../stage/entity";
import type { Point } from "../stage/geometry";
import type {
  AnimationKeyframe,
  SceneDefinition,
  TransformKeyframe,
} from "./timeline";

export interface PetEatsTreatOptions {
  origin: Point;
  direction: "left" | "right";
  petEntityId?: string;
  approachDistancePx?: number;
}

export type PetFood = "treat" | "kibble" | "can";
const INTERACTION_PROP_LAYER = 120;
const INTERACTION_EFFECT_LAYER = 125;

export interface PetEatsFoodOptions extends PetEatsTreatOptions {
  food: PetFood;
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

function transform(
  position: Point,
  alpha = 1,
  scale: Point = { x: 1, y: 1 },
  rotation = 0,
): EntityTransform {
  return { position, scale, rotation, alpha };
}

function petFrames(
  origin: Point,
  direction: number,
  approachDistance: number,
): TransformKeyframe[] {
  const eatingPosition = shifted(
    origin,
    direction,
    approachDistance,
  );
  const petTransform = (position: Point): EntityTransform =>
    transform(position, 1, { x: direction, y: 1 });
  return [
    { atMs: 0, value: petTransform(origin), easing: "easeOut" },
    { atMs: 700, value: petTransform(origin), easing: "easeOut" },
    {
      atMs: 1_800,
      value: petTransform(origin),
      easing: "easeInOut",
    },
    {
      atMs: 2_600,
      value: petTransform(eatingPosition),
      easing: "easeOut",
    },
    {
      atMs: 5_000,
      value: petTransform(eatingPosition),
      easing: "easeInOut",
    },
    {
      atMs: 6_500,
      value: petTransform(eatingPosition),
      easing: "linear",
    },
  ];
}

function treatFrames(
  origin: Point,
  direction: number,
): TransformKeyframe[] {
  const offscreen = shifted(origin, direction, 245, -72);
  const offered = shifted(origin, direction, 108, -64);
  const eating = shifted(origin, direction, 92, -58);
  return [
    {
      atMs: 0,
      value: transform(offscreen, 0, { x: direction, y: 1 }, -0.16 * direction),
      easing: "easeOut",
    },
    {
      atMs: 700,
      value: transform(offered, 1, { x: direction, y: 1 }, -0.08 * direction),
      easing: "easeOut",
    },
    {
      atMs: 1_800,
      value: transform(offered, 1, { x: direction, y: 1 }, -0.05 * direction),
      easing: "easeInOut",
    },
    {
      atMs: 2_600,
      value: transform(eating, 1, { x: direction, y: 1 }, 0.03 * direction),
      easing: "easeInOut",
    },
    {
      atMs: 5_000,
      value: transform(eating, 1, { x: direction, y: 1 }, -0.03 * direction),
      easing: "easeOut",
    },
    {
      atMs: 5_800,
      value: transform(offscreen, 0, { x: direction, y: 1 }, -0.16 * direction),
      easing: "easeIn",
    },
    {
      atMs: 6_500,
      value: transform(offscreen, 0, { x: direction, y: 1 }),
      easing: "linear",
    },
  ];
}

function dishFrames(
  origin: Point,
  direction: number,
): TransformKeyframe[] {
  const offscreen = shifted(origin, direction, 245, -4);
  const served = shifted(origin, direction, 82, -4);
  return [
    {
      atMs: 0,
      value: transform(offscreen, 0),
      easing: "easeOut",
    },
    {
      atMs: 700,
      value: transform(served, 1),
      easing: "easeOut",
    },
    {
      atMs: 5_800,
      value: transform(served, 1),
      easing: "easeIn",
    },
    {
      atMs: 6_500,
      value: transform(offscreen, 0),
      easing: "easeIn",
    },
  ];
}

function petAnimations(_direction: "left" | "right"): AnimationKeyframe[] {
  return [
    { atMs: 0, clip: "idle", loop: true },
    { atMs: 700, clip: "treatNotice", loop: false },
    { atMs: 1_800, clip: "treatApproach", loop: false },
    { atMs: 2_600, clip: "treatEat", loop: true },
    { atMs: 5_000, clip: "treatFinish", loop: false },
    { atMs: 5_800, clip: "idle", loop: true },
  ];
}

export function createPetEatsFoodScene(
  options: PetEatsFoodOptions,
): SceneDefinition {
  const petEntityId = options.petEntityId ?? "pet";
  const direction = options.direction === "right" ? 1 : -1;
  const approachDistance = Math.max(
    0,
    Math.min(45, options.approachDistancePx ?? 45),
  );
  const pet = petFrames(
    options.origin,
    direction,
    approachDistance,
  );
  const treat = treatFrames(options.origin, direction);
  const dish = dishFrames(options.origin, direction);
  const settled = shifted(
    options.origin,
    direction,
    approachDistance,
  );
  const foodPropId =
    options.food === "kibble"
      ? "kibble-bowl"
      : options.food === "can"
        ? "wet-food-can"
        : "treat-stick";
  const foodEntities =
    options.food === "treat"
      ? [
          {
            id: "treat-dish",
            kind: "prop" as const,
            layer: INTERACTION_PROP_LAYER,
            visual: "treat-dish",
            localBounds: { x: -48, y: -15, width: 96, height: 30 },
          },
          {
            id: "treat-stick",
            kind: "prop" as const,
            layer: INTERACTION_PROP_LAYER,
            visual: "treat-stick",
            localBounds: { x: -58, y: -18, width: 116, height: 36 },
          },
        ]
      : [
          {
            id: foodPropId,
            kind: "prop" as const,
            layer: INTERACTION_PROP_LAYER,
            visual: foodPropId,
            localBounds:
              options.food === "kibble"
                ? { x: -49, y: -30, width: 98, height: 60 }
                : { x: -38, y: -50, width: 76, height: 68 },
          },
        ];
  const foodTracks =
    options.food === "treat"
      ? [
          { entityId: "treat-dish", keyframes: dish },
          { entityId: "treat-stick", keyframes: treat },
        ]
      : [{ entityId: foodPropId, keyframes: dish }];
  return {
    id: `${petEntityId}-eats-${options.food}-${options.direction}`,
    durationMs: 6_500,
    boundsPadding: 28,
    entities: [
      {
        id: "pet-feed-shadow",
        kind: "shadow",
        layer: 0,
        visual: "pet-shadow",
        localBounds: { x: -68, y: -12, width: 136, height: 24 },
      },
      ...foodEntities,
      {
        id: "treat-sparkle",
        kind: "effect",
        layer: INTERACTION_EFFECT_LAYER,
        visual: "treat-sparkle",
        localBounds: { x: -28, y: -28, width: 56, height: 56 },
      },
    ],
    transformTracks: [
      { entityId: petEntityId, keyframes: pet },
      {
        entityId: "pet-feed-shadow",
        keyframes: pet.map((frame) => ({
          ...frame,
          value: transform(
            { x: frame.value.position.x, y: options.origin.y + 2 },
            0.5,
          ),
        })),
      },
      ...foodTracks,
      {
        entityId: "treat-sparkle",
        keyframes: treat.map((frame) => ({
          ...frame,
          value: transform(
            {
              x: frame.value.position.x - direction * 45,
              y: frame.value.position.y - 5,
            },
            frame.atMs >= 2_600 && frame.atMs <= 5_000
              ? 0.75
              : 0,
            { x: 1, y: 1 },
            frame.atMs / 700,
          ),
        })),
      },
    ],
    animationTracks: [
      {
        entityId: petEntityId,
        keyframes: petAnimations(options.direction),
      },
    ],
    events: [
      { id: "treat-enter", atMs: 0 },
      { id: "notice", atMs: 700 },
      { id: "approach", atMs: 1_800 },
      { id: "lick", atMs: 2_600 },
      { id: "satisfied", atMs: 5_000 },
      { id: "treat-exit", atMs: 5_800 },
    ],
    settlement: {
      petEntityId,
      petPosition: settled,
    },
  };
}

export function createPetEatsTreatScene(
  options: PetEatsTreatOptions,
): SceneDefinition {
  return createPetEatsFoodScene({ ...options, food: "treat" });
}
