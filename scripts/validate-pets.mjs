import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { z } from "zod";
import { analyzeFrame } from "./lib/sprite-components.mjs";

const atlasSchema = z.object({
  path: z.string().min(1),
  cellWidth: z.number().int().positive(),
  cellHeight: z.number().int().positive(),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
});

const animationSchema = z.object({
  atlas: z.string().min(1),
  row: z.number().int().nonnegative(),
  frames: z.array(z.number().int().nonnegative()).min(1),
  fps: z.number().positive(),
  loop: z.boolean(),
});

const phasedActionSchema = z
  .object({
    enter: z.string().min(1).optional(),
    loop: z.string().min(1),
    exit: z.string().min(1).optional(),
    loopDuration: z
      .object({
        minMs: z.number().int().positive(),
        maxMs: z.number().int().positive(),
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
      })
      .optional(),
  })
  .strict();

const interactionTimelineSchema = z
  .object({
    stages: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            animation: z.string().min(1),
            durationMs: z.number().int().positive(),
            propState: z
              .string()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const semanticActionsSchema = z
  .object({
    idle: phasedActionSchema,
    walkLeft: phasedActionSchema,
    walkRight: phasedActionSchema,
    look: phasedActionSchema,
    pet: phasedActionSchema,
    feed: phasedActionSchema,
    sleep: phasedActionSchema,
    groom: phasedActionSchema,
    stretch: phasedActionSchema,
    play: phasedActionSchema,
    pickedUp: phasedActionSchema,
    land: phasedActionSchema,
  })
  .strict();

const visualBoundsSchema = z
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
  });

const autonomousActionSchema = z.union([
  z.object({
    capability: z.string().min(1),
    playback: z.literal("once"),
  }),
  z
    .object({
      capability: z.string().min(1),
      playback: z.literal("timed"),
      minDurationMs: z.number().int().positive(),
      maxDurationMs: z.number().int().positive(),
    })
    .superRefine((action, context) => {
      if (action.maxDurationMs < action.minDurationMs) {
        context.addIssue({
          code: "custom",
          path: ["maxDurationMs"],
          message: "must be greater than or equal to minDurationMs",
        });
      }
    }),
]);

const positiveInteger = z.number().int().positive();
const behaviorCategorySchema = z.enum([
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
const behaviorActionSchema = z.union([
  z
    .object({
      ...behaviorActionBase,
      playback: z.literal("once"),
    })
    .strict(),
  z
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
    }),
]);
const behaviorProfileSchema = z
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
    const actionIds = new Set();
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
    ]) {
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

const petSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    displayName: z.string().min(1),
    description: z.string(),
    spriteVersionNumber: z.literal(2),
    display: z
      .object({
        scale: z.number().positive(),
        visualBounds: visualBoundsSchema.optional(),
        footAnchor: z
          .object({
            x: z.number().nonnegative(),
            y: z.number().nonnegative(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    atlases: z.record(z.string(), atlasSchema),
    animations: z.record(z.string(), animationSchema),
    capabilities: z
      .object({
        idle: z.string(),
        walkRight: z.string(),
        walkLeft: z.string(),
      })
      .catchall(z.string()),
    actions: semanticActionsSchema.optional(),
    interactionActions: z
      .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        phasedActionSchema,
      )
      .default({}),
    interactionTimelines: z
      .record(
        z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        interactionTimelineSchema,
      )
      .default({}),
    autonomousActions: z.array(autonomousActionSchema).default([]),
    behaviorProfile: behaviorProfileSchema.optional(),
  })
  .superRefine((pet, context) => {
    for (const [animationId, animation] of Object.entries(pet.animations)) {
      const atlas = pet.atlases[animation.atlas];
      if (!atlas) {
        context.addIssue({
          code: "custom",
          path: ["animations", animationId, "atlas"],
          message: `unknown atlas ${animation.atlas}`,
        });
        continue;
      }
      if (animation.row >= atlas.rows) {
        context.addIssue({
          code: "custom",
          path: ["animations", animationId, "row"],
          message: `row exceeds atlas rows ${atlas.rows}`,
        });
      }
      if (animation.frames.some((frame) => frame >= atlas.columns)) {
        context.addIssue({
          code: "custom",
          path: ["animations", animationId, "frames"],
          message: `frame exceeds atlas columns ${atlas.columns}`,
        });
      }
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
    for (const [capability, animation] of Object.entries(pet.capabilities)) {
      if (["failed", "waiting", "working", "review"].includes(capability)) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", capability],
          message: `legacy Codex capability "${capability}" is not allowed`,
        });
      }
      if (!pet.animations[animation]) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", capability],
          message: `unknown animation ${animation}`,
        });
      }
    }
    if (pet.actions) {
      for (const [actionId, action] of Object.entries(pet.actions)) {
        for (const phase of ["enter", "loop", "exit"]) {
          const animation = action[phase];
          if (animation && !pet.animations[animation]) {
            context.addIssue({
              code: "custom",
              path: ["actions", actionId, phase],
              message: `unknown animation ${animation}`,
            });
          }
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
            message: `unknown animation ${stage.animation}`,
          });
        }
      });
    }
    const scheduledCapabilities = new Set();
    pet.autonomousActions.forEach((action, index) => {
      if (!pet.capabilities[action.capability]) {
        context.addIssue({
          code: "custom",
          path: ["autonomousActions", index, "capability"],
          message: `unknown capability ${action.capability}`,
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
    if (pet.behaviorProfile) {
      pet.behaviorProfile.actions.forEach((action, index) => {
        if (!pet.capabilities[action.capability]) {
          context.addIssue({
            code: "custom",
            path: ["behaviorProfile", "actions", index, "capability"],
            message: `unknown capability ${action.capability}`,
          });
        }
      });
      pet.behaviorProfile.fallbackCapabilities.forEach((capability, index) => {
        if (!pet.capabilities[capability]) {
          context.addIssue({
            code: "custom",
            path: ["behaviorProfile", "fallbackCapabilities", index],
            message: `unknown capability ${capability}`,
          });
        }
      });
      for (const field of ["pickedUpCapability", "landCapability"]) {
        const capability = pet.behaviorProfile.interaction[field];
        if (!pet.capabilities[capability]) {
          context.addIssue({
            code: "custom",
            path: ["behaviorProfile", "interaction", field],
            message: `unknown capability ${capability}`,
          });
        }
      }
    }
  });

const catalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    defaultPet: z.string().min(1),
    pets: z.array(z.string().min(1)).min(1),
  })
  .superRefine((catalog, context) => {
    if (new Set(catalog.pets).size !== catalog.pets.length) {
      context.addIssue({
        code: "custom",
        path: ["pets"],
        message: "catalog pet ids must be unique",
      });
    }
    if (!catalog.pets.includes(catalog.defaultPet)) {
      context.addIssue({
        code: "custom",
        path: ["defaultPet"],
        message: "default pet must be registered",
      });
    }
  });

function issues(prefix, error) {
  return error.issues.map(
    (issue) => `${prefix} ${issue.path.join(".")}: ${issue.message}`,
  );
}

export async function validatePets(root) {
  const errors = [];
  const validPets = [];
  let catalog;
  try {
    catalog = catalogSchema.parse(
      JSON.parse(await readFile(join(root, "catalog.json"), "utf8")),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...issues("catalog", error));
    } else {
      errors.push(`catalog: ${error instanceof Error ? error.message : error}`);
    }
    return { validPets, errors };
  }

  for (const petId of catalog.pets) {
    try {
      const errorCountBeforePet = errors.length;
      const pet = petSchema.parse(
        JSON.parse(
          await readFile(join(root, petId, "pet.json"), "utf8"),
        ),
      );
      if (pet.id !== petId) {
        throw new Error(`manifest id ${pet.id} does not match directory ${petId}`);
      }
      for (const [atlasId, atlas] of Object.entries(pet.atlases)) {
        const atlasPath = join(root, petId, atlas.path);
        const metadata = await sharp(atlasPath).metadata();
        const expectedWidth = atlas.cellWidth * atlas.columns;
        const expectedHeight = atlas.cellHeight * atlas.rows;
        if (
          metadata.width !== expectedWidth ||
          metadata.height !== expectedHeight
        ) {
          throw new Error(
            `${petId} atlas ${atlasId} expected ${expectedWidth}x${expectedHeight}, ` +
              `received ${metadata.width}x${metadata.height}`,
          );
        }
        const { data, info } = await sharp(atlasPath)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const atlasVisibleBounds = {
          left: atlas.cellWidth,
          top: atlas.cellHeight,
          right: 0,
          bottom: 0,
        };
        let touchesCellEdge = false;
        for (let row = 0; row < atlas.rows; row += 1) {
          for (let column = 0; column < atlas.columns; column += 1) {
            const frame = extractFrame(
              data,
              info.width,
              atlas.cellWidth,
              atlas.cellHeight,
              row,
              column,
            );
            const analysis = analyzeFrame({
              data: frame,
              width: atlas.cellWidth,
              height: atlas.cellHeight,
            });
            if (analysis.suspiciousComponents.length > 0) {
              errors.push(
                `${petId} atlas ${atlasId} row ${row} column ${column}: ` +
                  `${analysis.suspiciousComponents.length} distant fragment(s)`,
              );
            }
            const visibleBounds = frameVisibleBounds(
              frame,
              atlas.cellWidth,
              atlas.cellHeight,
            );
            if (visibleBounds) {
              atlasVisibleBounds.left = Math.min(
                atlasVisibleBounds.left,
                visibleBounds.left,
              );
              atlasVisibleBounds.top = Math.min(
                atlasVisibleBounds.top,
                visibleBounds.top,
              );
              atlasVisibleBounds.right = Math.max(
                atlasVisibleBounds.right,
                visibleBounds.right,
              );
              atlasVisibleBounds.bottom = Math.max(
                atlasVisibleBounds.bottom,
                visibleBounds.bottom,
              );
              touchesCellEdge ||= (
                visibleBounds.left < 2 ||
                visibleBounds.top < 2 ||
                visibleBounds.right > atlas.cellWidth - 2 ||
                visibleBounds.bottom > atlas.cellHeight - 2
              );
            }
          }
        }
        if (touchesCellEdge) {
          errors.push(
            `${petId} atlas ${atlasId}: visible pixels touch the cell edge`,
          );
        }
        const safe = pet.display.visualBounds;
        if (
          safe &&
          atlasVisibleBounds.right > 0 &&
          (
            atlasVisibleBounds.left < safe.left ||
            atlasVisibleBounds.top < safe.top ||
            atlasVisibleBounds.right > safe.right ||
            atlasVisibleBounds.bottom > safe.bottom
          )
        ) {
          errors.push(
            `${petId} atlas ${atlasId}: visible pixels exceed display.visualBounds ` +
              `(${atlasVisibleBounds.left},${atlasVisibleBounds.top})-` +
              `(${atlasVisibleBounds.right},${atlasVisibleBounds.bottom})`,
          );
        }
      }
      if (errors.length === errorCountBeforePet) validPets.push(petId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...issues(petId, error));
      } else {
        errors.push(`${petId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  return { validPets, errors };
}

function frameVisibleBounds(data, width, height) {
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  let visible = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      visible = true;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return visible ? { left, top, right, bottom } : undefined;
}

function extractFrame(
  atlasData,
  atlasWidth,
  cellWidth,
  cellHeight,
  row,
  column,
) {
  const frame = Buffer.alloc(cellWidth * cellHeight * 4);
  for (let y = 0; y < cellHeight; y += 1) {
    const sourceStart =
      ((row * cellHeight + y) * atlasWidth + column * cellWidth) * 4;
    atlasData.copy(
      frame,
      y * cellWidth * 4,
      sourceStart,
      sourceStart + cellWidth * 4,
    );
  }
  return frame;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? "src/assets/pets");
  const result = await validatePets(root);
  for (const pet of result.validPets) console.log(`valid ${pet}`);
  for (const error of result.errors) console.error(`invalid ${error}`);
  if (result.errors.length > 0) process.exitCode = 1;
}
