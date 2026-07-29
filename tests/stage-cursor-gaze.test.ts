import { describe, expect, it, vi } from "vitest";

import { StageCursorGazeController } from "../src/app/interactions/stage-cursor-gaze";
import type { StageEntity } from "../src/app/stage/entity";

function actor(): StageEntity {
  return {
    id: "ying",
    kind: "pet",
    layer: 20,
    transient: false,
    visible: true,
    anchors: { look: { x: 0, y: -100 } },
    localBounds: { x: -60, y: -140, width: 120, height: 140 },
    transform: {
      position: { x: 500, y: 700 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      alpha: 1,
    },
    animation: { clip: "idle", loop: true, elapsedMs: 0 },
  };
}

describe("StageCursorGazeController", () => {
  it("polls and looks immediately only while the interaction menu is open", async () => {
    const pet = actor();
    let menuOpen = false;
    const cursorPosition = vi.fn(async () => ({ x: 900, y: 600 }));
    const controller = new StageCursorGazeController(
      pet,
      { cursorPosition },
      () => menuOpen,
    );

    await controller.update(0);
    expect(cursorPosition).not.toHaveBeenCalled();
    menuOpen = true;
    await controller.update(1);
    expect(cursorPosition).toHaveBeenCalledOnce();
    expect(pet.gazeDirectionIndex).toBe(4);
    menuOpen = false;
    await controller.update(2);
    expect(pet.gazeDirectionIndex).toBeUndefined();
  });

  it("uses the raw cursor direction without smoothing or distance limits", async () => {
    const pet = actor();
    const cursorPosition = vi
      .fn()
      .mockResolvedValueOnce({ x: 500, y: 100 })
      .mockResolvedValueOnce({ x: 500, y: 1_400 });
    const controller = new StageCursorGazeController(
      pet,
      { cursorPosition },
      () => true,
      0,
    );

    await controller.update(0);
    expect(pet.gazeDirectionIndex).toBe(0);
    await controller.update(1);
    expect(pet.gazeDirectionIndex).toBe(8);
  });

  it("clears directional gaze while the cursor is inside the pet body", async () => {
    const pet = actor();
    pet.gazeDirectionIndex = 4;
    const controller = new StageCursorGazeController(
      pet,
      {
        cursorPosition: vi.fn(async () => ({ x: 500, y: 650 })),
      },
      () => true,
      0,
    );

    await controller.update(0);

    expect(pet.gazeDirectionIndex).toBeUndefined();
  });
});
