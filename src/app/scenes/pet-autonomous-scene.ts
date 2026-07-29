import type { EntityTransform } from "../stage/entity";
import type { Point } from "../stage/geometry";
import type {
  AnimationKeyframe,
  SceneDefinition,
  TransformKeyframe,
} from "./timeline";

export type PetAutonomousAction =
  | "observe"
  | "walk"
  | "groom"
  | "sleep"
  | "askFood"
  | "seekAttention"
  | "happyHop"
  | "nuzzle"
  | "heartGreeting"
  | "bondedGreeting";

export interface PetAutonomousSceneOptions {
  petEntityId: string;
  action: PetAutonomousAction;
  origin: Point;
  direction?: "left" | "right";
  distance?: number;
  clip?: string;
  durationMs?: number;
  phases?: {
    enter?: { clip: string; durationMs: number };
    loop: { clip: string };
    exit?: { clip: string; durationMs: number };
  };
}

const durationByAction: Record<PetAutonomousAction, number> = {
  observe: 3_200,
  walk: 3_600,
  groom: 4_800,
  sleep: 12_000,
  askFood: 3_400,
  seekAttention: 3_200,
  happyHop: 3_600,
  nuzzle: 4_000,
  heartGreeting: 4_200,
  bondedGreeting: 4_800,
};

const clipByAction: Record<
  Exclude<PetAutonomousAction, "walk">,
  string
> = {
  observe: "look",
  groom: "groom",
  sleep: "sleep",
  askFood: "pet",
  seekAttention: "pet",
  happyHop: "play",
  nuzzle: "pet",
  heartGreeting: "pet",
  bondedGreeting: "pet",
};

function transform(
  position: Point,
  scale: Point = { x: 1, y: 1 },
  rotation = 0,
  alpha = 1,
): EntityTransform {
  return {
    position,
    scale,
    rotation,
    alpha,
  };
}

function stationaryFrames(
  origin: Point,
  durationMs: number,
  action: PetAutonomousAction,
): TransformKeyframe[] {
  const middleScale =
    action === "sleep"
      ? { x: 1.02, y: 0.98 }
      : action === "groom"
        ? { x: 1.01, y: 0.99 }
        : { x: 1, y: 1 };
  return [
    {
      atMs: 0,
      value: transform(origin),
      easing: "easeOut",
    },
    {
      atMs: Math.round(durationMs * 0.25),
      value: transform(origin, middleScale),
      easing: "easeInOut",
    },
    {
      atMs: Math.round(durationMs * 0.75),
      value: transform(origin, middleScale),
      easing: "easeInOut",
    },
    {
      atMs: durationMs,
      value: transform(origin),
      easing: "easeOut",
    },
  ];
}

function walkFrames(
  origin: Point,
  direction: number,
  distance: number,
  durationMs: number,
): TransformKeyframe[] {
  return [0, 0.18, 0.38, 0.6, 0.82, 1].map(
    (progress, index) => ({
      atMs: Math.round(durationMs * progress),
      value: transform({
        x: origin.x + direction * distance * progress,
        y:
          origin.y +
          (index === 1 || index === 3
            ? -2.5
            : index === 2 || index === 4
              ? 1
              : 0),
      }),
      easing: "easeInOut" as const,
    }),
  );
}

function reactionFrames(
  origin: Point,
  durationMs: number,
  action: PetAutonomousAction,
): TransformKeyframe[] | undefined {
  if (action === "happyHop") {
    return [
      { atMs: 0, value: transform(origin), easing: "easeOut" },
      {
        atMs: 650,
        value: transform(
          { x: origin.x, y: origin.y + 5 },
          { x: 1.04, y: 0.94 },
        ),
        easing: "easeIn",
      },
      {
        atMs: 1_150,
        value: transform(
          { x: origin.x, y: origin.y - 18 },
          { x: 0.98, y: 1.04 },
          -0.025,
        ),
        easing: "easeOut",
      },
      {
        atMs: 1_650,
        value: transform(
          { x: origin.x, y: origin.y },
          { x: 1.03, y: 0.96 },
          0.02,
        ),
        easing: "easeIn",
      },
      {
        atMs: 2_350,
        value: transform(
          { x: origin.x, y: origin.y - 13 },
          { x: 0.99, y: 1.02 },
          0.02,
        ),
        easing: "easeOut",
      },
      {
        atMs: durationMs,
        value: transform(origin),
        easing: "easeOut",
      },
    ];
  }
  if (action === "nuzzle") {
    return [
      { atMs: 0, value: transform(origin), easing: "easeOut" },
      {
        atMs: 700,
        value: transform(
          { x: origin.x + 7, y: origin.y + 1 },
          { x: 1.02, y: 0.99 },
          0.065,
        ),
        easing: "easeInOut",
      },
      {
        atMs: 1_650,
        value: transform(
          { x: origin.x - 5, y: origin.y },
          { x: 1.025, y: 0.985 },
          -0.075,
        ),
        easing: "easeInOut",
      },
      {
        atMs: 2_650,
        value: transform(
          { x: origin.x + 5, y: origin.y + 1 },
          { x: 1.015, y: 0.995 },
          0.055,
        ),
        easing: "easeInOut",
      },
      {
        atMs: durationMs,
        value: transform(origin),
        easing: "easeOut",
      },
    ];
  }
  return undefined;
}

export function createPetAutonomousScene(
  options: PetAutonomousSceneOptions,
): SceneDefinition {
  const durationMs =
    options.durationMs ?? durationByAction[options.action];
  const direction = options.direction === "left" ? -1 : 1;
  const distance =
    options.action === "walk"
      ? Math.max(40, Math.min(140, options.distance ?? 90))
      : 0;
  const settled = {
    x: options.origin.x + direction * distance,
    y: options.origin.y,
  };
  const activeClip =
    options.clip ??
    (options.action === "walk"
      ? direction < 0
        ? "walkLeft"
        : "walkRight"
      : clipByAction[options.action]);
  const phases = options.phases;
  const animations: AnimationKeyframe[] =
    options.action === "bondedGreeting"
      ? [
          { atMs: 0, clip: "pet", loop: false },
          { atMs: 1_400, clip: "play", loop: false },
          { atMs: 2_900, clip: "pet", loop: false },
          { atMs: 4_200, clip: "idle", loop: true },
        ]
      : options.action === "heartGreeting"
        ? [
            { atMs: 0, clip: "pet", loop: false },
            { atMs: 1_600, clip: "play", loop: false },
            { atMs: 3_500, clip: "idle", loop: true },
          ]
      : phases
    ? [
        {
          atMs: 0,
          clip: phases.enter?.clip ?? phases.loop.clip,
          loop: !phases.enter,
        },
        ...(phases.enter
          ? [
              {
                atMs: Math.min(
                  phases.enter.durationMs,
                  durationMs -
                    (phases.exit?.durationMs ?? 600),
                ),
                clip: phases.loop.clip,
                loop: true,
              },
            ]
          : []),
        ...(phases.exit
          ? [
              {
                atMs: durationMs - phases.exit.durationMs,
                clip: phases.exit.clip,
                loop: false,
              },
            ]
          : []),
        { atMs: durationMs, clip: "idle", loop: true },
      ]
    : [
        { atMs: 0, clip: activeClip, loop: true },
        {
          atMs: durationMs - 600,
          clip: "idle",
          loop: true,
        },
      ];
  const hasHeartEffect =
    options.action === "heartGreeting" ||
    options.action === "bondedGreeting";
  const effectEntityId = `${options.petEntityId}-bond-heart`;
  const entities =
    hasHeartEffect
      ? [
          {
            id: effectEntityId,
            kind: "effect" as const,
            layer: 35,
            visual: "bond-heart",
            localBounds: {
              x: -46,
              y: -50,
              width: 92,
              height: 100,
            },
          },
        ]
      : [];
  const effectTracks =
    hasHeartEffect
      ? [
          {
            entityId: effectEntityId,
            keyframes: [
              {
                atMs: 0,
                value: transform(
                  { x: options.origin.x, y: options.origin.y - 90 },
                  { x: 0.4, y: 0.4 },
                  -0.08,
                  0,
                ),
                easing: "easeOut" as const,
              },
              {
                atMs: 800,
                value: transform(
                  { x: options.origin.x, y: options.origin.y - 125 },
                  options.action === "heartGreeting"
                    ? { x: 0.78, y: 0.78 }
                    : { x: 1, y: 1 },
                  0.05,
                  1,
                ),
                easing: "easeOut" as const,
              },
              {
                atMs: 3_500,
                value: transform(
                  { x: options.origin.x, y: options.origin.y - 142 },
                  { x: 1.08, y: 1.08 },
                  -0.04,
                  0.9,
                ),
                easing: "easeInOut" as const,
              },
              {
                atMs: durationMs,
                value: transform(
                  { x: options.origin.x, y: options.origin.y - 165 },
                  { x: 0.8, y: 0.8 },
                  0.08,
                  0,
                ),
                easing: "easeIn" as const,
              },
            ],
          },
        ]
      : [];
  return {
    id: [
      options.petEntityId,
      "autonomous",
      options.action,
      options.direction ?? "still",
    ].join("-"),
    durationMs,
    boundsPadding: 28,
    entities,
    transformTracks: [
      {
        entityId: options.petEntityId,
        keyframes:
          options.action === "walk"
            ? walkFrames(
                options.origin,
                direction,
                distance,
                durationMs,
              )
            : (reactionFrames(
                options.origin,
                durationMs,
                options.action,
              ) ??
              stationaryFrames(
                options.origin,
                durationMs,
                options.action,
              )),
      },
      ...effectTracks,
    ],
    animationTracks: [
      {
        entityId: options.petEntityId,
        keyframes: animations,
      },
    ],
    events: [
      { id: `${options.action}-start`, atMs: 0 },
      { id: `${options.action}-finish`, atMs: durationMs - 600 },
    ],
    settlement: {
      petEntityId: options.petEntityId,
      petPosition: settled,
    },
  };
}
