import { describe, expect, it, vi } from "vitest";

import type { StageEntity } from "../src/app/stage/entity";
import type { SceneDefinition } from "../src/app/scenes/timeline";
import { TimelinePlayer } from "../src/app/scenes/timeline-player";

function pet(): StageEntity {
  return {
    id: "ying",
    kind: "pet",
    layer: 20,
    transient: false,
    visible: true,
    transform: {
      position: { x: 0, y: 720 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
  };
}

function transform(x: number) {
  return {
    position: { x, y: 720 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    alpha: 1,
  };
}

const scene: SceneDefinition = {
  id: "timeline-contract",
  durationMs: 4_000,
  boundsPadding: 24,
  entities: [],
  transformTracks: [
    {
      entityId: "ying",
      keyframes: [
        { atMs: 0, value: transform(0), easing: "linear" },
        { atMs: 2_000, value: transform(100), easing: "linear" },
        { atMs: 4_000, value: transform(300), easing: "linear" },
      ],
    },
  ],
  animationTracks: [
    {
      entityId: "ying",
      keyframes: [
        { atMs: 0, clip: "idle", loop: true },
        { atMs: 1_000, clip: "notice", loop: false },
        { atMs: 3_000, clip: "run", loop: true },
      ],
    },
  ],
  events: [
    { id: "scene-start", atMs: 0 },
    { id: "notice", atMs: 1_000 },
    { id: "chase", atMs: 3_000 },
  ],
  settlement: {
    petEntityId: "ying",
    petPosition: { x: 300, y: 720 },
  },
};

describe("TimelinePlayer", () => {
  it("samples transforms and animation state at the elapsed time", () => {
    const ying = pet();
    const player = new TimelinePlayer(
      scene,
      (id) => (id === "ying" ? ying : undefined),
    );

    player.update(3_500);

    expect(ying.transform).toEqual(transform(250));
    expect(ying.animation).toEqual({
      clip: "run",
      loop: true,
      elapsedMs: 500,
    });
  });

  it("emits every crossed event once, including the zero-time marker", () => {
    const ying = pet();
    const onEvent = vi.fn();
    const player = new TimelinePlayer(
      scene,
      (id) => (id === "ying" ? ying : undefined),
      onEvent,
    );

    player.update(3_000);
    player.update(0);

    expect(onEvent.mock.calls.map(([event]) => event.id)).toEqual([
      "scene-start",
      "notice",
      "chase",
    ]);
  });

  it("lands exactly at the final keyframe and reports completion", () => {
    const ying = pet();
    const player = new TimelinePlayer(
      scene,
      (id) => (id === "ying" ? ying : undefined),
    );

    player.update(20_000);

    expect(ying.transform).toEqual(transform(300));
    expect(player.elapsedMs).toBe(4_000);
    expect(player.complete).toBe(true);
  });

  it("applies easing to a segment without changing its endpoints", () => {
    const ying = pet();
    const easedScene: SceneDefinition = {
      ...scene,
      durationMs: 1_000,
      transformTracks: [
        {
          entityId: "ying",
          keyframes: [
            {
              atMs: 0,
              value: transform(0),
              easing: "easeIn",
            },
            {
              atMs: 1_000,
              value: transform(100),
              easing: "linear",
            },
          ],
        },
      ],
    };
    const player = new TimelinePlayer(
      easedScene,
      (id) => (id === "ying" ? ying : undefined),
    );

    player.update(500);

    expect(ying.transform.position.x).toBe(25);
  });
});
