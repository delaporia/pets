export function butterflyWingScale(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  const phase = (elapsed % 240) / 240;
  return 0.35 + 0.65 * Math.abs(Math.cos(phase * Math.PI * 2));
}
