import { describe, expect, it } from "vitest";

import { AnimationPlayer } from "../src/app/animation/animation-player";
import type { LoadedPet } from "../src/app/pets/pet-loader";
import { parsePetManifest } from "../src/app/pets/schemas";

const manifest = parsePetManifest({
  schemaVersion: 1,
  id: "pet",
  displayName: "Pet",
  description: "",
  spriteVersionNumber: 2,
  display: { scale: 1 },
  atlases: {
    main: {
      path: "sheet.webp",
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 11,
    },
  },
  animations: {
    idle: { atlas: "main", row: 0, frames: [0, 1], fps: 10, loop: true },
    walkRight: {
      atlas: "main",
      row: 1,
      frames: [4, 5],
      fps: 10,
      loop: true,
    },
    walkLeft: {
      atlas: "main",
      row: 2,
      frames: [6, 7],
      fps: 10,
      loop: true,
    },
    lookUpper: {
      atlas: "main",
      row: 9,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      fps: 4,
      loop: false,
    },
    lookLower: {
      atlas: "main",
      row: 10,
      frames: [0, 1, 2, 3, 4, 5, 6, 7],
      fps: 4,
      loop: false,
    },
  },
  capabilities: {
    idle: "idle",
    walkRight: "walkRight",
    walkLeft: "walkLeft",
    lookUpper: "lookUpper",
    lookLower: "lookLower",
  },
});

const image = {} as HTMLImageElement;
const pet: LoadedPet = {
  manifest,
  images: new Map([["main", image]]),
};

describe("AnimationPlayer", () => {
  it("advances the active animation using elapsed time", () => {
    const player = new AnimationPlayer(pet);
    player.play("idle");

    expect(player.update(99).column).toBe(0);
    expect(player.update(1).column).toBe(1);
  });

  it("restarts elapsed time when the animation changes", () => {
    const player = new AnimationPlayer(pet);
    player.play("idle");
    player.update(150);
    player.play("walkRight");

    const frame = player.update(0);
    expect(frame.animationId).toBe("walkRight");
    expect(frame.column).toBe(4);
    expect(frame.row).toBe(1);
  });

  it("keeps elapsed time when replaying without restart", () => {
    const player = new AnimationPlayer(pet);
    player.play("idle");
    player.update(100);
    player.play("idle");

    expect(player.update(0).column).toBe(1);
  });

  it("holds one of the sixteen gaze frames until the gaze clears", () => {
    const player = new AnimationPlayer(pet);
    player.play("idle");

    player.look(10);
    expect(player.update(1_000)).toMatchObject({
      animationId: "lookLower",
      row: 10,
      column: 2,
    });

    player.clearLook();
    expect(player.update(0).animationId).toBe("idle");
  });
});
