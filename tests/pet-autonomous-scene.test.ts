import { describe, expect, it } from "vitest";

import { createPetAutonomousScene } from "../src/app/scenes/pet-autonomous-scene";

describe("pet autonomous scenes", () => {
  it("creates a bounded walk with coordinated body bob and an idle ending", () => {
    const scene = createPetAutonomousScene({
      petEntityId: "wuyi",
      action: "walk",
      origin: { x: 500, y: 700 },
      direction: "left",
      distance: 90,
    });
    const transform = scene.transformTracks[0]!;
    const animation = scene.animationTracks[0]!;

    expect(scene.durationMs).toBeGreaterThanOrEqual(3_000);
    expect(transform.keyframes.length).toBeGreaterThanOrEqual(6);
    expect(scene.settlement.petPosition).toEqual({
      x: 410,
      y: 700,
    });
    expect(animation.keyframes[0]?.clip).toBe("walkLeft");
    expect(animation.keyframes.at(-1)?.clip).toBe("idle");
  });

  it("uses semantic clips for non-movement personality actions", () => {
    expect(
      createPetAutonomousScene({
        petEntityId: "duobi",
        action: "groom",
        origin: { x: 500, y: 700 },
      }).animationTracks[0]?.keyframes[0]?.clip,
    ).toBe("groom");
    expect(
      createPetAutonomousScene({
        petEntityId: "ying",
        action: "askFood",
        origin: { x: 500, y: 700 },
      }).animationTracks[0]?.keyframes[0]?.clip,
    ).toBe("pet");
  });

  it("plays a manifest-selected capability without core action changes", () => {
    const scene = createPetAutonomousScene({
      petEntityId: "duobi",
      action: "observe",
      clip: "stretch",
      durationMs: 2_750,
      origin: { x: 500, y: 700 },
    });

    expect(scene.durationMs).toBe(2_750);
    expect(scene.animationTracks[0]?.keyframes[0]?.clip).toBe(
      "stretch",
    );
  });

  it("plays a pet-specific enter, loop, and exit sequence for sleep", () => {
    const scene = createPetAutonomousScene({
      petEntityId: "duobi",
      action: "sleep",
      origin: { x: 500, y: 700 },
      phases: {
        enter: { clip: "curlSleepEnter", durationMs: 1_000 },
        loop: { clip: "curlSleepLoop" },
        exit: { clip: "curlSleepExit", durationMs: 700 },
      },
    });

    expect(
      scene.animationTracks[0]?.keyframes.map(
        ({ clip, loop }) => [clip, loop],
      ),
    ).toEqual([
      ["curlSleepEnter", false],
      ["curlSleepLoop", true],
      ["curlSleepExit", false],
      ["idle", true],
    ]);
    expect(
      scene.animationTracks[0]?.keyframes.at(-2)?.atMs,
    ).toBe(scene.durationMs - 700);
  });

  it("creates a visible heart-effect celebration for a fully bonded pet", () => {
    const scene = createPetAutonomousScene({
      petEntityId: "ying",
      action: "bondedGreeting",
      origin: { x: 500, y: 700 },
    });

    expect(scene.entities).toEqual([
      expect.objectContaining({
        id: "ying-bond-heart",
        kind: "effect",
        visual: "bond-heart",
      }),
    ]);
    expect(
      scene.transformTracks.some(
        ({ entityId }) => entityId === "ying-bond-heart",
      ),
    ).toBe(true);
    expect(
      scene.animationTracks[0]?.keyframes.map(({ clip }) => clip),
    ).toEqual(["pet", "play", "pet", "idle"]);
  });

  it("gives social reactions distinct motion and visual signatures", () => {
    const hop = createPetAutonomousScene({
      petEntityId: "ying",
      action: "happyHop",
      origin: { x: 500, y: 700 },
    });
    const nuzzle = createPetAutonomousScene({
      petEntityId: "ying",
      action: "nuzzle",
      origin: { x: 500, y: 700 },
    });
    const greeting = createPetAutonomousScene({
      petEntityId: "ying",
      action: "heartGreeting",
      origin: { x: 500, y: 700 },
    });

    expect(
      Math.min(
        ...hop.transformTracks[0]!.keyframes.map(
          ({ value }) => value.position.y,
        ),
      ),
    ).toBeLessThan(690);
    expect(
      nuzzle.transformTracks[0]!.keyframes.some(
        ({ value }) => Math.abs(value.rotation) >= 0.05,
      ),
    ).toBe(true);
    expect(greeting.entities).toEqual([
      expect.objectContaining({
        visual: "bond-heart",
      }),
    ]);
  });
});
