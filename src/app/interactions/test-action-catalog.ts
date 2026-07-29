import {
  semanticActionIds,
  type PetManifest,
  type PhasedActionDefinition,
  type SemanticActionId,
} from "../pets/schemas";

export interface TestActionStep {
  clip: string;
  durationMs: number;
  loop: boolean;
}

export interface TestActionEntry {
  id: string;
  label: string;
  kind: "semantic" | "interaction" | "timeline";
  steps: TestActionStep[];
}

const semanticLabels: Record<SemanticActionId, string> = {
  idle: "待机",
  walkLeft: "向左走",
  walkRight: "向右走",
  look: "观察",
  pet: "抚摸回应",
  feed: "吃饭",
  sleep: "睡觉",
  groom: "舔毛",
  stretch: "伸展",
  play: "玩耍",
  pickedUp: "被提起",
  land: "落地",
};

const testModeSemanticOrder: readonly SemanticActionId[] = [
  "idle",
  "pet",
  "feed",
  "play",
  "sleep",
  "groom",
  ...semanticActionIds.filter(
    (id) =>
      !["idle", "pet", "feed", "play", "sleep", "groom"].includes(id),
  ),
];

function clipDuration(
  manifest: PetManifest,
  clip: string,
): number {
  const resolved = manifest.capabilities[clip] ?? clip;
  const animation = manifest.animations[resolved];
  if (!animation) return 800;
  return Math.max(
    240,
    Math.round((animation.frames.length / animation.fps) * 1_000),
  );
}

export function phasedSteps(
  manifest: PetManifest,
  definition: PhasedActionDefinition,
): TestActionStep[] {
  const steps: TestActionStep[] = [];
  if (definition.enter) {
    steps.push({
      clip: definition.enter,
      durationMs: clipDuration(manifest, definition.enter),
      loop: false,
    });
  }
  const loopDuration = clipDuration(manifest, definition.loop);
  steps.push({
    clip: definition.loop,
    durationMs: Math.min(3_000, Math.max(700, loopDuration)),
    loop: true,
  });
  if (definition.exit) {
    steps.push({
      clip: definition.exit,
      durationMs: clipDuration(manifest, definition.exit),
      loop: false,
    });
  }
  return steps;
}

export function testActionCatalog(
  manifest: PetManifest,
): TestActionEntry[] {
  const entries: TestActionEntry[] = testModeSemanticOrder.map((id) => ({
    id,
    label: semanticLabels[id],
    kind: "semantic",
    steps: phasedSteps(manifest, manifest.actions[id]),
  }));
  return entries;
}
