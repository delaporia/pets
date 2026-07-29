import { describe, expect, it } from "vitest";

import type { StageEntity } from "../src/app/stage/entity";
import { EntityRegistry } from "../src/app/stage/entity-registry";
import { SceneDirector } from "../src/app/scenes/scene-director";
import type {
  SceneDefinition,
  SceneEntityDeclaration,
} from "../src/app/scenes/timeline";

function pet(): StageEntity {
  return {
    id: "ying",
    kind: "pet",
    layer: 20,
    transient: false,
    visible: true,
    transform: {
      position: { x: 300, y: 700 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

function transform(x: number) {
  return {
    position: { x, y: 700 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    alpha: 1,
  };
}

const scene: SceneDefinition = {
  id: "director-contract",
  durationMs: 1_000,
  boundsPadding: 24,
  entities: [
    {
      id: "butterfly",
      kind: "prop",
      layer: 30,
      visual: "butterfly",
    },
  ],
  transformTracks: [
    {
      entityId: "ying",
      keyframes: [
        { atMs: 0, value: transform(300), easing: "linear" },
        { atMs: 1_000, value: transform(500), easing: "linear" },
      ],
    },
    {
      entityId: "butterfly",
      keyframes: [
        {
          atMs: 0,
          value: {
            ...transform(420),
            position: { x: 420, y: 620 },
          },
          easing: "linear",
        },
        {
          atMs: 1_000,
          value: {
            ...transform(650),
            position: { x: 650, y: 580 },
          },
          easing: "linear",
        },
      ],
    },
  ],
  animationTracks: [],
  events: [],
  settlement: {
    petEntityId: "ying",
    petPosition: { x: 500, y: 700 },
  },
};

function createEntity(
  declaration: SceneEntityDeclaration,
): StageEntity {
  return {
    id: declaration.id,
    kind: declaration.kind,
    layer: declaration.layer,
    transient: true,
    visible: true,
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

function fixture() {
  const registry = new EntityRegistry();
  const ying = pet();
  registry.add(ying);
  const director = new SceneDirector(registry, createEntity);
  return { registry, ying, director };
}

describe("SceneDirector", () => {
  it("settles the pet at the endpoint and releases transient actors", async () => {
    const { registry, ying, director } = fixture();
    const result = director.play(scene);

    director.update(scene.durationMs);

    await expect(result).resolves.toEqual({
      sceneId: "director-contract",
      status: "completed",
    });
    expect(ying.transform.position).toEqual({ x: 500, y: 700 });
    expect(registry.ordered().map(({ id }) => id)).toEqual(["ying"]);
    expect(director.activeSceneId).toBeUndefined();
  });

  it("interrupts once, cleans resources, and preserves the sampled pet position", async () => {
    const { registry, ying, director } = fixture();
    const result = director.play(scene);
    director.update(500);
    const sampled = { ...ying.transform.position };

    expect(director.interrupt("drag")).toBe(true);
    expect(director.interrupt("drag")).toBe(false);

    await expect(result).resolves.toEqual({
      sceneId: "director-contract",
      status: "interrupted",
      reason: "drag",
    });
    expect(sampled).toEqual({ x: 400, y: 700 });
    expect(ying.transform.position).toEqual(sampled);
    expect(registry.ordered().map(({ id }) => id)).toEqual(["ying"]);
  });

  it("rejects an overlapping scene without disturbing the active one", () => {
    const { director } = fixture();
    void director.play(scene);

    expect(() => director.play({ ...scene, id: "second-scene" }))
      .toThrow('Scene "director-contract" is already active');
    expect(director.activeSceneId).toBe("director-contract");
  });
});
