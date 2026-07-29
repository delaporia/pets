import { describe, expect, it } from "vitest";

import type {
  EntityKind,
  StageEntity,
} from "../src/app/stage/entity";
import { EntityRegistry } from "../src/app/stage/entity-registry";

function entity(
  id: string,
  kind: EntityKind,
  layer: number,
  transient: boolean,
): StageEntity {
  return {
    id,
    kind,
    layer,
    transient,
    visible: true,
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

describe("EntityRegistry", () => {
  it("orders entities by layer and keeps insertion order within a layer", () => {
    const registry = new EntityRegistry();
    registry.add(entity("pet", "pet", 20, false));
    registry.add(entity("foreground-prop", "prop", 30, true));
    registry.add(entity("shadow", "shadow", 0, true));
    registry.add(entity("second-pet-layer-item", "effect", 20, true));

    expect(registry.ordered().map(({ id }) => id)).toEqual([
      "shadow",
      "pet",
      "second-pet-layer-item",
      "foreground-prop",
    ]);
  });

  it("clears transient scene actors without removing the persistent pet", () => {
    const registry = new EntityRegistry();
    registry.add(entity("pet", "pet", 20, false));
    registry.add(entity("shadow", "shadow", 0, true));
    registry.add(entity("butterfly", "prop", 30, true));

    registry.clearTransient();

    expect(registry.ordered().map(({ id }) => id)).toEqual(["pet"]);
  });

  it("rejects duplicate ids so one scene cannot replace another entity", () => {
    const registry = new EntityRegistry();
    registry.add(entity("ying", "pet", 20, false));

    expect(() =>
      registry.add(entity("ying", "pet", 20, false)),
    ).toThrow('Duplicate entity "ying"');
  });

  it("returns the removed entity and no longer exposes it", () => {
    const registry = new EntityRegistry();
    const butterfly = entity("butterfly", "prop", 30, true);
    registry.add(butterfly);

    expect(registry.remove("butterfly")).toBe(butterfly);
    expect(registry.remove("butterfly")).toBeUndefined();
    expect(registry.ordered()).toEqual([]);
  });
});
