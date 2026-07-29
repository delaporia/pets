import type {
  InteractionTimelineDefinition,
  PetManifest,
  PhasedActionDefinition,
  SemanticActionId,
} from "../pets/schemas";
import type { BodyInteractionResult } from "./body-interaction";
import type { SecondaryInteraction } from "./interaction-wheel-model";

export const interactionActionIds = [
  "touch-head",
  "touch-head-fast",
  "touch-chin",
  "touch-belly",
  "touch-tail",
  "feed-treat",
  "feed-kibble",
  "feed-can",
  "play-butterfly",
  "play-ball",
  "play-wand",
] as const;

export type InteractionActionId =
  (typeof interactionActionIds)[number];

type SharedScene = "treat" | "butterfly";

export type ResolvedPetInteraction =
  | {
      kind: "scene";
      source: "shared";
      actionId: InteractionActionId;
      scene: SharedScene;
    }
  | {
      kind: "timeline";
      source: "pet";
      actionId: InteractionActionId;
      definition: InteractionTimelineDefinition;
    }
  | {
      kind: "phased";
      source: "pet";
      actionId: InteractionActionId;
      definition: PhasedActionDefinition;
    }
  | {
      kind: "semantic";
      source: "fallback";
      actionId: SemanticActionId;
    };

const fallbackByAction: Record<
  InteractionActionId,
  Extract<SemanticActionId, "pet" | "feed" | "play">
> = {
  "touch-head": "pet",
  "touch-head-fast": "pet",
  "touch-chin": "pet",
  "touch-belly": "pet",
  "touch-tail": "pet",
  "feed-treat": "feed",
  "feed-kibble": "feed",
  "feed-can": "feed",
  "play-butterfly": "play",
  "play-ball": "play",
  "play-wand": "play",
};

const actionIdByOption: Record<
  SecondaryInteraction,
  InteractionActionId
> = {
  treat: "feed-treat",
  kibble: "feed-kibble",
  can: "feed-can",
  butterfly: "play-butterfly",
  ball: "play-ball",
  wand: "play-wand",
};

export function interactionActionIdForOption(
  option: SecondaryInteraction,
): InteractionActionId {
  return actionIdByOption[option];
}

export function interactionActionIdForBody(
  result: BodyInteractionResult,
): InteractionActionId {
  if (result.zone === "tail") return "touch-tail";
  if (result.zone === "belly") return "touch-belly";
  if (result.zone === "chin") return "touch-chin";
  return result.intensity === "excited"
    ? "touch-head-fast"
    : "touch-head";
}

export function resolvePetInteraction(
  manifest: PetManifest,
  actionId: InteractionActionId,
): ResolvedPetInteraction {
  if (actionId === "feed-treat") {
    return {
      kind: "scene",
      source: "shared",
      actionId,
      scene: "treat",
    };
  }
  if (actionId === "play-butterfly") {
    return {
      kind: "scene",
      source: "shared",
      actionId,
      scene: "butterfly",
    };
  }
  const timeline = manifest.interactionTimelines[actionId];
  if (timeline) {
    return {
      kind: "timeline",
      source: "pet",
      actionId,
      definition: timeline,
    };
  }
  const phased = manifest.interactionActions[actionId];
  if (phased) {
    return {
      kind: "phased",
      source: "pet",
      actionId,
      definition: phased,
    };
  }
  return {
    kind: "semantic",
    source: "fallback",
    actionId: fallbackByAction[actionId],
  };
}
