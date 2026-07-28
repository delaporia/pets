export function frameAt(
  elapsedMs: number,
  fps: number,
  frameCount: number,
  loop: boolean,
): number {
  if (fps <= 0) {
    throw new Error("fps must be greater than zero");
  }
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new Error("frameCount must be a positive integer");
  }

  const rawFrame = Math.floor(Math.max(0, elapsedMs) / (1000 / fps));
  return loop
    ? rawFrame % frameCount
    : Math.min(rawFrame, frameCount - 1);
}
