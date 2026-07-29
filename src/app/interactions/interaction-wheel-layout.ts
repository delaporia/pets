import type { Point } from "../runtime/pet-context";

export type InteractionWheelLayoutPhase = "primary" | "secondary";

const primaryArc: Point[] = [
  { x: 10, y: -72 },
  { x: 54, y: -24 },
  { x: 54, y: 24 },
  { x: 10, y: 72 },
];

const secondaryOffsets: Record<number, number[]> = {
  1: [0],
  2: [-24, 24],
  3: [-48, 0, 48],
};

export function interactionWheelLayout(
  phase: InteractionWheelLayoutPhase,
  optionCount: number,
  side: "left" | "right",
): Point[] {
  const direction = side === "right" ? 1 : -1;
  if (phase === "primary") {
    return primaryArc
      .slice(0, optionCount)
      .map(({ x, y }) => ({ x: x * direction, y }));
  }
  const offsets =
    secondaryOffsets[Math.min(3, Math.max(1, optionCount))] ?? [];
  return offsets.slice(0, optionCount).map((y) => ({
    x: 54 * direction,
    y,
  }));
}
