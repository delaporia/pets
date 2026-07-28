import { describe, expect, it } from "vitest";

import { frameAt } from "../src/app/animation/animation-clock";

describe("frameAt", () => {
  it("advances on exact frame boundaries", () => {
    expect(frameAt(0, 10, 8, true)).toBe(0);
    expect(frameAt(99, 10, 8, true)).toBe(0);
    expect(frameAt(100, 10, 8, true)).toBe(1);
  });

  it("wraps a looping animation", () => {
    expect(frameAt(800, 10, 8, true)).toBe(0);
  });

  it("holds the final frame of a non-looping animation", () => {
    expect(frameAt(900, 10, 8, false)).toBe(7);
  });

  it("rejects invalid timing inputs", () => {
    expect(() => frameAt(0, 0, 8, true)).toThrow(/fps/);
    expect(() => frameAt(0, 8, 0, true)).toThrow(/frameCount/);
  });
});
