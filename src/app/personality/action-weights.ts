import type { BehaviorCategory } from "../pets/schemas";
import type { PersonalityMode } from "./profiles";

const categoryMultipliers: Record<
  PersonalityMode,
  Record<BehaviorCategory, number>
> = {
  quiet: { movement: 0.5, ambient: 1.4, rest: 1.4, social: 0.7 },
  balanced: { movement: 1, ambient: 1, rest: 1, social: 1 },
  lively: { movement: 1.5, ambient: 0.7, rest: 0.6, social: 1.35 },
  test: { movement: 0, ambient: 0, rest: 0, social: 0 },
};

export function personalityCategoryMultiplier(
  category: BehaviorCategory,
  mode: PersonalityMode,
): number {
  return categoryMultipliers[mode][category];
}
