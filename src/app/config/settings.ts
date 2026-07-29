import { z } from "zod";
import { personalityModes } from "../personality/profiles";

export const userSettingsSchema = z
  .object({
    schemaVersion: z.literal(1),
    selectedPetId: z.string(),
    personalityMode: z.enum(personalityModes).default("balanced"),
    activityPaused: z.boolean(),
    visible: z.boolean(),
    autostart: z.boolean(),
    petScale: z
      .union([
        z.literal(0.75),
        z.literal(1),
        z.literal(1.25),
        z.literal(1.5),
      ])
      .default(1),
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
    petScale: 1,
  };
}

export function migrateUserSettings(
  settings: UserSettings,
): UserSettings {
  return settings;
}

export function parseUserSettings(input: unknown): UserSettings {
  const legacyCompatible =
    typeof input === "object" && input !== null
      ? Object.fromEntries(
          Object.entries(input).filter(
            ([key]) =>
              key !== "careModelVersion" && key !== "careByPet",
          ),
        )
      : input;
  const result = userSettingsSchema.safeParse(legacyCompatible);
  if (!result.success) {
    throw new Error(
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  }
  return result.data;
}
