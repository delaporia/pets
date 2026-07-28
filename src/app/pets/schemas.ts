import { z } from "zod";

const positiveInteger = z.number().int().positive();

export const atlasDefinitionSchema = z
  .object({
    path: z.string().min(1),
    cellWidth: positiveInteger,
    cellHeight: positiveInteger,
    columns: positiveInteger,
    rows: positiveInteger,
  })
  .strict();

export const animationDefinitionSchema = z
  .object({
    atlas: z.string().min(1),
    row: z.number().int().nonnegative(),
    frames: z.array(z.number().int().nonnegative()).min(1),
    fps: z.number().positive(),
    loop: z.boolean(),
  })
  .strict();

export const semanticActionIds = [
  "idle",
  "walkLeft",
  "walkRight",
  "look",
  "pet",
  "feed",
  "sleep",
  "groom",
  "stretch",
  "play",
  "pickedUp",
  "land",
] as const;

export const semanticActionIdSchema = z.enum(semanticActionIds);

const phasedLoopDurationSchema = z
  .object({
    minMs: positiveInteger,
    maxMs: positiveInteger,
  })
  .strict()
  .superRefine((duration, context) => {
    if (duration.maxMs < duration.minMs) {
      context.addIssue({
        code: "custom",
        path: ["maxMs"],
        message: "must be greater than or equal to minMs",
      });
    }
  });

export const phasedActionDefinitionSchema = z
  .object({
    enter: z.string().min(1).optional(),
    loop: z.string().min(1),
    exit: z.string().min(1).optional(),
    loopDuration: phasedLoopDurationSchema.optional(),
  })
  .strict();

export const interactionTimelineStageSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    animation: z.string().min(1),
    durationMs: positiveInteger,
    propState: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
  })
  .strict();

export const interactionTimelineDefinitionSchema = z
  .object({
    stages: z.array(interactionTimelineStageSchema).min(1),
  })
  .strict()
  .superRefine((definition, context) => {
    const ids = new Set<string>();
    definition.stages.forEach((stage, index) => {
      if (ids.has(stage.id)) {
        context.addIssue({
          code: "custom",
          path: ["stages", index, "id"],
          message: "timeline stage ids must be unique",
        });
      }
      ids.add(stage.id);
    });
  });

export const semanticActionsSchema = z
  .object({
    idle: phasedActionDefinitionSchema,
    walkLeft: phasedActionDefinitionSchema,
    walkRight: phasedActionDefinitionSchema,
    look: phasedActionDefinitionSchema,
    pet: phasedActionDefinitionSchema,
    feed: phasedActionDefinitionSchema,
    sleep: phasedActionDefinitionSchema,
    groom: phasedActionDefinitionSchema,
    stretch: phasedActionDefinitionSchema,
    play: phasedActionDefinitionSchema,
    pickedUp: phasedActionDefinitionSchema,
    land: phasedActionDefinitionSchema,
  })
  .strict();

const legacySemanticActions: z.input<typeof semanticActionsSchema> = {
  idle: { loop: "idle" },
  walkLeft: { loop: "walkLeft" },
  walkRight: { loop: "walkRight" },
  look: { loop: "idle" },
  pet: { loop: "idle" },
  feed: { loop: "idle" },
  sleep: { loop: "idle" },
  groom: { loop: "idle" },
  stretch: { loop: "idle" },
  play: { loop: "idle" },
  pickedUp: { loop: "idle" },
  land: { loop: "idle" },
};

const onceAutonomousActionSchema = z
  .object({
    capability: z.string().min(1),
    playback: z.literal("once"),
  })
  .strict();

const timedAutonomousActionSchema = z
  .object({
    capability: z.string().min(1),
    playback: z.literal("timed"),
    minDurationMs: positiveInteger,
    maxDurationMs: positiveInteger,
  })
  .strict()
  .superRefine((action, context) => {
    if (action.maxDurationMs < action.minDurationMs) {
      context.addIssue({
        code: "custom",
        path: ["maxDurationMs"],
        message: "must be greater than or equal to minDurationMs",
      });
    }
  });

export const autonomousActionSchema = z.union([
  onceAutonomousActionSchema,
  timedAutonomousActionSchema,
]);

export const behaviorCategorySchema = z.enum([
  "movement",
  "ambient",
  "rest",
  "social",
]);

const behaviorActionBase = {
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  capability: z.string().min(1),
  category: behaviorCategorySchema,
  weight: z.number().positive(),
  cooldownMs: z.number().int().nonnegative().default(0),
};

const onceBehaviorActionSchema = z
  .object({
    ...behaviorActionBase,
    playback: z.literal("once"),
  })
  .strict();

const timedBehaviorActionSchema = z
  .object({
    ...behaviorActionBase,
    playback: z.literal("timed"),
    minDurationMs: positiveInteger,
    maxDurationMs: positiveInteger,
  })
  .strict()
  .superRefine((action, context) => {
    if (action.maxDurationMs < action.minDurationMs) {
      context.addIssue({
        code: "custom",
        path: ["maxDurationMs"],
        message: "must be greater than or equal to minDurationMs",
      });
    }
  });

export const behaviorActionSchema = z.union([
  onceBehaviorActionSchema,
  timedBehaviorActionSchema,
]);

export const behaviorProfileSchema = z
  .object({
    scheduler: z
      .object({
        minIntervalMs: positiveInteger,
        maxIntervalMs: positiveInteger,
        recoveryMs: positiveInteger,
      })
      .strict()
      .superRefine((scheduler, context) => {
        if (scheduler.maxIntervalMs < scheduler.minIntervalMs) {
          context.addIssue({
            code: "custom",
            path: ["maxIntervalMs"],
            message: "must be greater than or equal to minIntervalMs",
          });
        }
      }),
    movement: z
      .object({
        walkSpeed: z.number().positive(),
        minDurationMs: positiveInteger,
        maxDurationMs: positiveInteger,
        roamingHalfWidth: z.number().nonnegative(),
      })
      .strict()
      .superRefine((movement, context) => {
        if (movement.maxDurationMs < movement.minDurationMs) {
          context.addIssue({
            code: "custom",
            path: ["maxDurationMs"],
            message: "must be greater than or equal to minDurationMs",
          });
        }
      }),
    categoryWeights: z
      .object({
        movement: z.number().nonnegative(),
        ambient: z.number().nonnegative(),
        rest: z.number().nonnegative(),
        social: z.number().nonnegative(),
      })
      .strict()
      .superRefine((weights, context) => {
        if (Object.values(weights).every((weight) => weight === 0)) {
          context.addIssue({
            code: "custom",
            message: "at least one category weight must be greater than zero",
          });
        }
      }),
    actions: z.array(behaviorActionSchema).default([]),
    interaction: z
      .object({
        nearbyRadius: z.number().positive(),
        cursorPollMs: positiveInteger,
        multiClickWindowMs: positiveInteger,
        multiClickThreshold: z.number().int().min(2),
        singleClickAction: z.string().min(1).optional(),
        multiClickAction: z.string().min(1).optional(),
        nearbyAction: z.string().min(1).optional(),
        pickedUpCapability: z.string().min(1),
        landCapability: z.string().min(1),
      })
      .strict(),
    fallbackCapabilities: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .superRefine((profile, context) => {
    const actionIds = new Set<string>();
    profile.actions.forEach((action, index) => {
      if (actionIds.has(action.id)) {
        context.addIssue({
          code: "custom",
          path: ["actions", index, "id"],
          message: "behavior action ids must be unique",
        });
      }
      actionIds.add(action.id);
    });
    for (const field of [
      "singleClickAction",
      "multiClickAction",
      "nearbyAction",
    ] as const) {
      const actionId = profile.interaction[field];
      if (actionId && !actionIds.has(actionId)) {
        context.addIssue({
          code: "custom",
          path: ["interaction", field],
          message: `unknown behavior action "${actionId}"`,
        });
      }
    }
  });

export const defaultBehaviorProfile: z.output<typeof behaviorProfileSchema> = {
  scheduler: {
    minIntervalMs: 6_000,
    maxIntervalMs: 12_000,
    recoveryMs: 6_000,
  },
  movement: {
    walkSpeed: 45,
    minDurationMs: 3_000,
    maxDurationMs: 6_000,
    roamingHalfWidth: 200,
  },
  categoryWeights: {
    movement: 1,
    ambient: 0,
    rest: 0,
    social: 0,
  },
  actions: [],
  interaction: {
    nearbyRadius: 240,
    cursorPollMs: 250,
    multiClickWindowMs: 1_800,
    multiClickThreshold: 3,
    pickedUpCapability: "idle",
    landCapability: "idle",
  },
  fallbackCapabilities: ["idle"],
};

const petManifestBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    displayName: z.string().min(1),
    description: z.string().default(""),
    spriteVersionNumber: z.literal(2),
    display: z
      .object({
        scale: z.number().positive(),
        visualBounds: z
          .object({
            left: z.number().nonnegative(),
            top: z.number().nonnegative(),
            right: z.number().positive(),
            bottom: z.number().positive(),
          })
          .strict()
          .superRefine((bounds, context) => {
            if (bounds.right <= bounds.left) {
              context.addIssue({
                code: "custom",
                path: ["right"],
                message: "must be greater than left",
              });
            }
            if (bounds.bottom <= bounds.top) {
              context.addIssue({
                code: "custom",
                path: ["bottom"],
                message: "must be greater than top",
              });
            }
          })
          .optional(),
        footAnchor: z
          .object({
            x: z.number().nonnegative(),
            y: z.number().nonnegative(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    atlases: z.record(z.string(), atlasDefinitionSchema),
    animations: z.record(z.string(), animationDefinitionSchema),
    capabilities: z
      .object({
        idle: z.string().min(1),
        walkRight: z.string().min(1),
        walkLeft: z.string().min(1),
      })
      .catchall(z.string().min(1)),
    actions: semanticActionsSchema.default(legacySemanticActions),
    interactionActions: z
      .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        phasedActionDefinitionSchema,
      )
      .default({}),
    interactionTimelines: z
      .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        interactionTimelineDefinitionSchema,
      )
      .default({}),
    autonomousActions: z.array(autonomousActionSchema).default([]),
    behaviorProfile: behaviorProfileSchema.default(defaultBehaviorProfile),
  })
  .strict();

export const petManifestSchema = petManifestBaseSchema.superRefine(
  (pet, context) => {
    for (const [animationId, animation] of Object.entries(pet.animations)) {
      const atlas = pet.atlases[animation.atlas];
      if (!atlas) {
        context.addIssue({
          code: "custom",
          path: ["animations", animationId, "atlas"],
          message: `unknown atlas "${animation.atlas}"`,
        });
        continue;
      }

      if (animation.row >= atlas.rows) {
        context.addIssue({
          code: "custom",
          path: ["animations", animationId, "row"],
          message: `row must be less than ${atlas.rows}`,
        });
      }

      animation.frames.forEach((frame, index) => {
        if (frame >= atlas.columns) {
          context.addIssue({
            code: "custom",
            path: ["animations", animationId, "frames", index],
            message: `frame must be less than ${atlas.columns}`,
          });
        }
      });
    }

    const firstAtlas = Object.values(pet.atlases)[0];
    if (firstAtlas && pet.display.visualBounds) {
      const bounds = pet.display.visualBounds;
      if (
        bounds.right > firstAtlas.cellWidth ||
        bounds.bottom > firstAtlas.cellHeight
      ) {
        context.addIssue({
          code: "custom",
          path: ["display", "visualBounds"],
          message: "must fit inside the atlas cell",
        });
      }
    }
    if (firstAtlas && pet.display.footAnchor) {
      const anchor = pet.display.footAnchor;
      if (anchor.x > firstAtlas.cellWidth || anchor.y > firstAtlas.cellHeight) {
        context.addIssue({
          code: "custom",
          path: ["display", "footAnchor"],
          message: "must fit inside the atlas cell",
        });
      }
    }

    for (const [capability, animationId] of Object.entries(
      pet.capabilities,
    )) {
      if (["failed", "waiting", "working", "review"].includes(capability)) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", capability],
          message: `legacy Codex capability "${capability}" is not allowed`,
        });
      }
      if (!pet.animations[animationId]) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", capability],
          message: `unknown animation "${animationId}"`,
        });
      }
    }

    for (const [actionId, action] of Object.entries(pet.actions)) {
      for (const phase of ["enter", "loop", "exit"] as const) {
        const animationId = action[phase];
        if (animationId && !pet.animations[animationId]) {
          context.addIssue({
            code: "custom",
            path: ["actions", actionId, phase],
            message: `unknown animation "${animationId}"`,
          });
        }
      }
    }

    for (const [actionId, action] of Object.entries(
      pet.interactionActions,
    )) {
      for (const phase of ["enter", "loop", "exit"] as const) {
        const animationId = action[phase];
        if (animationId && !pet.animations[animationId]) {
          context.addIssue({
            code: "custom",
            path: ["interactionActions", actionId, phase],
            message: `unknown animation "${animationId}"`,
          });
        }
      }
    }

    for (const [actionId, definition] of Object.entries(
      pet.interactionTimelines,
    )) {
      definition.stages.forEach((stage, index) => {
        if (!pet.animations[stage.animation]) {
          context.addIssue({
            code: "custom",
            path: [
              "interactionTimelines",
              actionId,
              "stages",
              index,
              "animation",
            ],
            message: `unknown animation "${stage.animation}"`,
          });
        }
      });
    }

    const scheduledCapabilities = new Set<string>();
    pet.autonomousActions.forEach((action, index) => {
      if (!pet.capabilities[action.capability]) {
        context.addIssue({
          code: "custom",
          path: ["autonomousActions", index, "capability"],
          message: `unknown capability "${action.capability}"`,
        });
      }
      if (scheduledCapabilities.has(action.capability)) {
        context.addIssue({
          code: "custom",
          path: ["autonomousActions", index, "capability"],
          message: "autonomous action capabilities must be unique",
        });
      }
      scheduledCapabilities.add(action.capability);
    });

    pet.behaviorProfile.actions.forEach((action, index) => {
      if (!pet.capabilities[action.capability]) {
        context.addIssue({
          code: "custom",
          path: ["behaviorProfile", "actions", index, "capability"],
          message: `unknown capability "${action.capability}"`,
        });
      }
    });

    for (const [index, capability] of
      pet.behaviorProfile.fallbackCapabilities.entries()) {
      if (!pet.capabilities[capability]) {
        context.addIssue({
          code: "custom",
          path: ["behaviorProfile", "fallbackCapabilities", index],
          message: `unknown capability "${capability}"`,
        });
      }
    }

    for (const field of ["pickedUpCapability", "landCapability"] as const) {
      const capability = pet.behaviorProfile.interaction[field];
      if (!pet.capabilities[capability]) {
        context.addIssue({
          code: "custom",
          path: ["behaviorProfile", "interaction", field],
          message: `unknown capability "${capability}"`,
        });
      }
    }
  },
);

const catalogBaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    defaultPet: z.string().min(1),
    pets: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const catalogSchema = catalogBaseSchema.superRefine(
  (catalog, context) => {
    if (new Set(catalog.pets).size !== catalog.pets.length) {
      context.addIssue({
        code: "custom",
        path: ["pets"],
        message: "pet ids must be unique",
      });
    }
    if (!catalog.pets.includes(catalog.defaultPet)) {
      context.addIssue({
        code: "custom",
        path: ["defaultPet"],
        message: "defaultPet must be registered in pets",
      });
    }
  },
);

export type AtlasDefinition = z.infer<typeof atlasDefinitionSchema>;
export type AnimationDefinition = z.infer<typeof animationDefinitionSchema>;
export type SemanticActionId = z.infer<typeof semanticActionIdSchema>;
export type PhasedActionDefinition = z.infer<
  typeof phasedActionDefinitionSchema
>;
export type InteractionTimelineStage = z.infer<
  typeof interactionTimelineStageSchema
>;
export type InteractionTimelineDefinition = z.infer<
  typeof interactionTimelineDefinitionSchema
>;
export type AutonomousAction = z.infer<typeof autonomousActionSchema>;
export type BehaviorCategory = z.infer<typeof behaviorCategorySchema>;
export type BehaviorAction = z.infer<typeof behaviorActionSchema>;
export type BehaviorProfile = z.infer<typeof behaviorProfileSchema>;
export type PetManifest = z.infer<typeof petManifestSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

function parseWithReadablePaths<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw new Error(
    result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n"),
  );
}

export function parsePetManifest(input: unknown): PetManifest {
  return parseWithReadablePaths(petManifestSchema, input);
}

export function parseCatalog(input: unknown): Catalog {
  return parseWithReadablePaths(catalogSchema, input);
}
