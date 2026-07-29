import type { PetManifest } from "../pets/schemas";

export type RuntimeKind = "legacy" | "stage";

export function runtimeKindFor(manifest: PetManifest): RuntimeKind {
  return manifest.sceneEngine === "realtime-v1"
    ? "stage"
    : "legacy";
}
