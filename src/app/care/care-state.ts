import { z } from "zod";

const careValueSchema = z.number().finite().min(0).max(100);

export const petCareStateSchema = z
  .object({
    satiety: careValueSchema,
    energy: careValueSchema,
    affection: careValueSchema,
    lastUpdatedAt: z.number().finite().nonnegative(),
  })
  .strict();

export type PetCareState = z.infer<typeof petCareStateSchema>;
export type CareAction = "pet" | "feed" | "play" | "sleep";

const hourMs = 60 * 60 * 1_000;
const maximumOfflineMs = 7 * 24 * hourMs;

export function defaultPetCareState(nowMs: number): PetCareState {
  return {
    satiety: 80,
    energy: 80,
    affection: 0,
    lastUpdatedAt: Math.max(0, nowMs),
  };
}

export function settleCareState(
  state: PetCareState,
  nowMs: number,
): PetCareState {
  if (nowMs <= state.lastUpdatedAt) return { ...state };
  const elapsedMs = Math.min(
    maximumOfflineMs,
    nowMs - state.lastUpdatedAt,
  );
  const elapsedHours = elapsedMs / hourMs;
  return {
    satiety: clampCareValue(state.satiety - elapsedHours * 2),
    energy: clampCareValue(state.energy - elapsedHours),
    affection: clampCareValue(state.affection),
    lastUpdatedAt: nowMs,
  };
}

export function applyCareAction(
  state: PetCareState,
  action: CareAction,
  nowMs: number,
): PetCareState {
  const settled = settleCareState(state, nowMs);
  const effects: Record<
    CareAction,
    Pick<PetCareState, "satiety" | "energy" | "affection">
  > = {
    pet: { satiety: 0, energy: 0, affection: 6 },
    feed: { satiety: 30, energy: 2, affection: 2 },
    play: { satiety: -4, energy: -8, affection: 8 },
    sleep: { satiety: -2, energy: 35, affection: 1 },
  };
  const effect = effects[action];
  return {
    satiety: clampCareValue(settled.satiety + effect.satiety),
    energy: clampCareValue(settled.energy + effect.energy),
    affection: clampCareValue(settled.affection + effect.affection),
    lastUpdatedAt: settled.lastUpdatedAt,
  };
}

function clampCareValue(value: number): number {
  return Math.min(100, Math.max(0, value));
}
