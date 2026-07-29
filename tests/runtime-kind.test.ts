import { describe, expect, it } from "vitest";

import { runtimeKindFor } from "../src/app/bootstrap/runtime-kind";
import type { PetManifest } from "../src/app/pets/schemas";

describe("runtimeKindFor", () => {
  it("selects the realtime stage only for an opted-in pet", () => {
    expect(
      runtimeKindFor({
        sceneEngine: "realtime-v1",
      } as PetManifest),
    ).toBe("stage");
    expect(runtimeKindFor({} as PetManifest)).toBe("legacy");
  });
});
