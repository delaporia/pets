import { z } from "zod";
import { personalityModes } from "../personality/profiles";
import { petCareStateSchema } from "../care/care-state";

export const userSettingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    selectedPetId: z.string(),
    personalityMode: z.enum(personalityModes).default("balanced"),
    activityPaused: z.boolean(),
    visible: z.boolean(),
    autostart: z.boolean(),
    careModelVersion: z.union([z.literal(1), z.literal(2)]).default(1),
    petScale: z.union([
      z.literal(0.75),
      z.literal(1),
      z.literal(1.25),
      z.literal(1.5),
    ]).default(1),
    careByPet: z.record(z.string().min(1), petCareStateSchema).default({}),
  })
  .strict();

export type UserSettings = z.infer<typeof userSettingsSchema>;

export function defaultUserSettings(): UserSettings {
  return {
    schemaVersion: 1,
    selectedPetId: "",
    personalityMode: "balanced",
    activityPaused: false,
    visible: true,
    autostart: true,
    careModelVersion: 2,
    petScale: 1,
    careByPet: {},
  };
}

export function migrateUserSettings(settings: UserSettings): UserSettings {
  if (settings.careModelVersion >= 2) return settings;
  return {
    ...settings,
    careModelVersion: 2,
    careByPet: Object.fromEntries(
      Object.entries(settings.careByPet).map(([petId, care]) => [
        petId,
        { ...care, affection: 0 },
      ]),
    ),
  };
}

export function parseUserSettings(input: unknown): UserSettings {
  const result = userSettingsSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  }
  return result.data;
}
