import type { PersonalityMode } from "../personality/profiles";
import type { BehaviorCategory } from "../pets/schemas";
import type { PetCareState } from "./care-state";

export function careWeightMultiplier(
  actionId: string,
  care: PetCareState,
): number {
  switch (actionId) {
    case "deep-rest":
      return 0.25 + (100 - care.energy) / 25;
    case "playful-hop":
      return 0.2 + Math.min(care.energy, care.satiety) / 100;
    case "pet-response":
      return 0.5 + care.affection / 100;
    case "look-around":
      return 0.75 + care.affection / 200;
    case "self-groom":
      return care.energy < 20 ? 0.6 : 1;
    default:
      return 1;
  }
}

const personalityCategoryMultipliers: Record<
  PersonalityMode,
  Record<BehaviorCategory, number>
> = {
  quiet: {
    movement: 0.5,
    ambient: 1.4,
    rest: 1.4,
    social: 0.7,
  },
  balanced: {
    movement: 1,
    ambient: 1,
    rest: 1,
    social: 1,
  },
  lively: {
    movement: 1.5,
    ambient: 0.7,
    rest: 0.6,
    social: 1.35,
  },
  test: {
    movement: 0,
    ambient: 0,
    rest: 0,
    social: 0,
  },
};

export function personalityCategoryMultiplier(
  category: BehaviorCategory,
  mode: PersonalityMode,
): number {
  return personalityCategoryMultipliers[mode][category];
}
