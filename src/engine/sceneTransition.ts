// Smoothly interpolate the lens and registered scene exposures over each shot.
export function between(value: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}
