import type { BodyInteractionResult } from "./body-interaction";
import type { SecondaryInteraction } from "./interaction-wheel-model";
import type { PetMenuAction } from "./pet-menu-controller";

export type YingPropCue =
  | "treat"
  | "kibble"
  | "can"
  | "ball"
  | "butterfly"
  | "wand";

export type YingBodyFeedback =
  | "pleased"
  | "curious"
  | "mischief"
  | "surprised";

export interface YingSecondaryInteraction {
  careAction: Exclude<PetMenuAction, "wake">;
  behaviorId: string;
  prop?: YingPropCue;
}

export interface YingBodyReaction {
  careAction: Exclude<PetMenuAction, "wake">;
  behaviorId: string;
  feedback: YingBodyFeedback;
}

const secondaryInteractions: Record<
  SecondaryInteraction,
  YingSecondaryInteraction
> = {
  treat: { careAction: "feed", behaviorId: "feed-treat", prop: "treat" },
  kibble: {
    careAction: "feed",
    behaviorId: "feed-kibble",
    prop: "kibble",
  },
  can: { careAction: "feed", behaviorId: "feed-can", prop: "can" },
  ball: { careAction: "play", behaviorId: "play-ball", prop: "ball" },
  butterfly: {
    careAction: "play",
    behaviorId: "play-butterfly",
    prop: "butterfly",
  },
  wand: { careAction: "play", behaviorId: "play-wand", prop: "wand" },
  sleep: { careAction: "sleep", behaviorId: "sleep" },
  wake: { careAction: "sleep", behaviorId: "wake" },
};

export function interactionForYingSecondary(
  option: SecondaryInteraction,
): YingSecondaryInteraction {
  return secondaryInteractions[option];
}

export function semanticActionForYingSecondary(
  option: SecondaryInteraction,
): PetMenuAction {
  if (option === "wake") return "wake";
  return interactionForYingSecondary(option).careAction;
}

export function interactionForYingBody(
  result: BodyInteractionResult,
): YingBodyReaction {
  if (result.zone === "tail") {
    return {
      careAction: "play",
      behaviorId: "touch-tail",
      feedback: "mischief",
    };
  }
  if (result.zone === "belly") {
    return {
      careAction: "play",
      behaviorId: "touch-belly",
      feedback:
        result.intensity === "excited" ? "surprised" : "curious",
    };
  }
  if (result.zone === "chin") {
    return {
      careAction: "pet",
      behaviorId: "touch-chin",
      feedback: "pleased",
    };
  }
  return {
    careAction:
      result.intensity === "excited" ? "play" : "pet",
    behaviorId:
      result.intensity === "excited" ? "touch-head-fast" : "touch-head",
    feedback:
      result.intensity === "excited" ? "curious" : "pleased",
  };
}

export function semanticActionForYingBodyInteraction(
  result: BodyInteractionResult,
): Exclude<PetMenuAction, "wake"> {
  return interactionForYingBody(result).careAction;
}
