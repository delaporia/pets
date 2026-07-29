import sceneTiming from "./data/pet-chase-butterfly.json";
import type { EntityTransform } from "../stage/entity";
import type { Point } from "../stage/geometry";
import type {
  AnimationKeyframe,
  SceneDefinition,
  TransformKeyframe,
} from "./timeline";
import type { PetSceneMotionProfile } from "./pet-scene-motion-profile";
import { petSceneMotionProfileFor } from "./pet-scene-motion-profile";

export interface PetChaseButterflyOptions {
  origin: Point;
  direction: "left" | "right";
  distance: "near" | "mid";
  distancePx?: number;
  pathVariant: 1 | 2;
  endingVariant: "escape" | "caught";
  petEntityId?: string;
  motion?: PetSceneMotionProfile;
}

function transform(
  position: Point,
  alpha = 1,
  scale: Point = { x: 1, y: 1 },
  rotation = 0,
): EntityTransform {
  return {
    position,
    scale,
    rotation,
    alpha,
  };
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

function petKeyframes(
  origin: Point,
  direction: number,
  distance: number,
  motion: PetSceneMotionProfile,
): TransformKeyframe[] {
  const at = (
    horizontal: number,
    vertical: number,
    scale: Point = { x: 1, y: 1 },
    rotation = 0,
  ): EntityTransform =>
    transform(
      shifted(origin, direction, horizontal, vertical),
      1,
      scale,
      rotation * direction,
    );
  return [
    { atMs: 0, value: transform(origin), easing: "easeOut" },
    {
      atMs: 700,
      value: at(
        0,
        0,
        { x: 1, y: 1 },
        motion.observeLean,
      ),
      easing: "easeInOut",
    },
    {
      atMs: 1_500,
      value: at(0, 4, {
        x: 2 - motion.crouchCompression,
        y: motion.crouchCompression,
      }),
      easing: "easeIn",
    },
    {
      atMs: 2_500,
      value: at(distance * 0.1, 0),
      easing: "easeIn",
    },
    {
      atMs: 3_100,
      value: at(distance * 0.27, -motion.runBobPx),
      easing: "easeInOut",
    },
    {
      atMs: 3_700,
      value: at(distance * 0.43, motion.runBobPx * 0.35),
      easing: "easeInOut",
    },
    {
      atMs: 4_300,
      value: at(distance * 0.58, -motion.runBobPx),
      easing: "easeInOut",
    },
    {
      atMs: 5_000,
      value: at(distance * 0.72, -6, {
        x: 2 - motion.pounceStretch,
        y: motion.pounceStretch,
      }),
      easing: "easeOut",
    },
    {
      atMs: 6_000,
      value: at(distance, -2, {
        x: 2 - motion.landingCompression,
        y: motion.landingCompression,
      }),
      easing: "easeOut",
    },
    {
      atMs: 6_800,
      value: transform(
        shifted(origin, direction, distance),
      ),
      easing: "easeInOut",
    },
    {
      atMs: 8_200,
      value: transform(
        shifted(origin, direction, distance),
      ),
      easing: "linear",
    },
  ];
}

function butterflyKeyframes(
  options: PetChaseButterflyOptions,
  direction: number,
  distance: number,
): TransformKeyframe[] {
  const { origin, pathVariant, endingVariant } = options;
  const flightHeight = pathVariant === 1 ? -145 : -210;
  const secondHeight = pathVariant === 1 ? -190 : -120;
  const points = [
    shifted(origin, direction, -140, flightHeight),
    shifted(origin, direction, 35, secondHeight),
    shifted(origin, direction, 120, flightHeight - 25),
    shifted(origin, direction, distance * 0.48, -175),
    shifted(origin, direction, distance * 0.88, -105),
    shifted(origin, direction, distance, -65),
    endingVariant === "escape"
      ? shifted(origin, direction, distance + 120, -245)
      : shifted(origin, direction, distance - 10, -45),
    endingVariant === "escape"
      ? shifted(origin, direction, distance + 190, -310)
      : shifted(origin, direction, distance - 8, -42),
  ];
  const times = [0, 700, 1_500, 2_500, 5_000, 6_000, 6_800, 8_200];
  return points.map((position, index) => {
    const next = points[index + 1];
    const horizontalBend = pathVariant === 1 ? 45 : 75;
    return {
      atMs: times[index]!,
      value: transform(
        position,
        endingVariant === "escape" && index === points.length - 1
          ? 0
          : 1,
        { x: 0.8, y: 0.8 },
      ),
      easing: "easeInOut" as const,
      positionPath: next
        ? {
            start: position,
            control1: {
              x: position.x + direction * horizontalBend,
              y: position.y - 35,
            },
            control2: {
              x: next.x - direction * horizontalBend,
              y: next.y + 30,
            },
            end: next,
          }
        : undefined,
    };
  });
}

function petAnimations(
  direction: "left" | "right",
): AnimationKeyframe[] {
  const walk = direction === "left" ? "walkLeft" : "walkRight";
  return [
    { atMs: 0, clip: "idle", loop: true },
    { atMs: 700, clip: "look", loop: false },
    { atMs: 1_500, clip: walk, loop: true },
    { atMs: 2_500, clip: walk, loop: true },
    { atMs: 5_000, clip: "play", loop: false },
    { atMs: 6_000, clip: "pet", loop: false },
    { atMs: 6_800, clip: "idle", loop: true },
  ];
}

export function createPetChasesButterflyScene(
  options: PetChaseButterflyOptions,
): SceneDefinition {
  const petEntityId = options.petEntityId ?? "pet";
  const motion =
    options.motion ?? petSceneMotionProfileFor(petEntityId);
  const direction = options.direction === "right" ? 1 : -1;
  const distance =
    options.distancePx === undefined
      ? (options.distance === "near" ? 140 : 220) *
        motion.strideScale
      : Math.max(0, options.distancePx);
  const petFrames = petKeyframes(
    options.origin,
    direction,
    distance,
    motion,
  );
  const butterflyFrames = butterflyKeyframes(
    options,
    direction,
    distance,
  );
  return {
    id: [
      "pet-chases-butterfly",
      petEntityId,
      options.direction,
      options.distance,
      options.pathVariant,
      options.endingVariant,
    ].join("-"),
    durationMs: sceneTiming.durationMs,
    boundsPadding: 28,
    entities: [
      {
        id: "pet-shadow",
        kind: "shadow",
        layer: 0,
        visual: "pet-shadow",
        localBounds: {
          x: -68,
          y: -12,
          width: 136,
          height: 24,
        },
      },
      {
        id: "butterfly",
        kind: "prop",
        layer: 30,
        visual: "butterfly",
        localBounds: {
          x: -22,
          y: -18,
          width: 44,
          height: 36,
        },
      },
      {
        id: "butterfly-trail",
        kind: "effect",
        layer: 29,
        visual: "butterfly-trail",
        localBounds: {
          x: -34,
          y: -24,
          width: 68,
          height: 48,
        },
      },
    ],
    transformTracks: [
      { entityId: petEntityId, keyframes: petFrames },
      {
        entityId: "pet-shadow",
        keyframes: petFrames.map((frame) => ({
          ...frame,
          positionPath: undefined,
          value: transform(
            {
              x: frame.value.position.x,
              y: options.origin.y + 2,
            },
            frame.atMs === 5_000 ? 0.35 : 0.5,
            frame.atMs === 5_000
              ? { x: 0.75, y: 0.75 }
              : { x: 1, y: 1 },
          ),
        })),
      },
      { entityId: "butterfly", keyframes: butterflyFrames },
      {
        entityId: "butterfly-trail",
        keyframes: butterflyFrames.map((frame) => ({
          ...frame,
          value: {
            ...frame.value,
            position: {
              x: frame.value.position.x - direction * 18,
              y: frame.value.position.y + 8,
            },
            alpha: frame.value.alpha * 0.42,
          },
        })),
      },
    ],
    animationTracks: [
      {
        entityId: petEntityId,
        keyframes: petAnimations(options.direction),
      },
      {
        entityId: "butterfly",
        keyframes: [
          { atMs: 0, clip: "flutter", loop: true },
        ],
      },
    ],
    events: sceneTiming.beats.map((beat) => ({
      id:
        beat.id === "ending"
          ? options.endingVariant
          : beat.id,
      atMs: beat.atMs,
    })),
    settlement: {
      petEntityId,
      petPosition: shifted(
        options.origin,
        direction,
        distance,
      ),
    },
  };
}
