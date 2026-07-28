export const personalityModes = [
  "quiet",
  "balanced",
  "lively",
  "test",
] as const;
export type PersonalityMode = (typeof personalityModes)[number];

export interface PersonalityProfile {
  schedulerMultiplier: number;
  walkSpeedMultiplier: number;
  schedulerMinMs: number;
  schedulerMaxMs: number;
  categoryWeights: {
    movement: number;
    ambient: number;
    social: number;
  };
  walkSpeed: number;
  runSpeed: number;
  sleepMinMs: number;
  sleepMaxMs: number;
  pointerInterest: "disabled" | "occasional" | "frequent";
}

export const personalityProfiles: Record<
  PersonalityMode,
  PersonalityProfile
> = {
  quiet: {
    schedulerMultiplier: 1.4,
    walkSpeedMultiplier: 0.8,
    schedulerMinMs: 8_000,
    schedulerMaxMs: 20_000,
    categoryWeights: { movement: 10, ambient: 65, social: 25 },
    walkSpeed: 30,
    runSpeed: 55,
    sleepMinMs: 20_000,
    sleepMaxMs: 60_000,
    pointerInterest: "disabled",
  },
  balanced: {
    schedulerMultiplier: 1,
    walkSpeedMultiplier: 1,
    schedulerMinMs: 3_000,
    schedulerMaxMs: 8_000,
    categoryWeights: { movement: 30, ambient: 40, social: 30 },
    walkSpeed: 45,
    runSpeed: 80,
    sleepMinMs: 10_000,
    sleepMaxMs: 30_000,
    pointerInterest: "occasional",
  },
  lively: {
    schedulerMultiplier: 0.75,
    walkSpeedMultiplier: 1.2,
    schedulerMinMs: 1_000,
    schedulerMaxMs: 4_000,
    categoryWeights: { movement: 45, ambient: 20, social: 35 },
    walkSpeed: 65,
    runSpeed: 110,
    sleepMinMs: 5_000,
    sleepMaxMs: 12_000,
    pointerInterest: "frequent",
  },
  test: {
    schedulerMultiplier: 1,
    walkSpeedMultiplier: 1,
    schedulerMinMs: 1_000,
    schedulerMaxMs: 1_000,
    categoryWeights: { movement: 0, ambient: 0, social: 0 },
    walkSpeed: 0,
    runSpeed: 0,
    sleepMinMs: 2_500,
    sleepMaxMs: 2_500,
    pointerInterest: "disabled",
  },
};
