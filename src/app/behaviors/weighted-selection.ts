export function selectWeighted<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  random: number,
): T | undefined {
  const weighted = items
    .map((item) => ({
      item,
      weight: Math.max(0, weightOf(item)),
    }))
    .filter(({ weight }) => weight > 0);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (total === 0) return undefined;

  let cursor = Math.min(0.999_999_999, Math.max(0, random)) * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.item;
  }
  return weighted.at(-1)?.item;
}
