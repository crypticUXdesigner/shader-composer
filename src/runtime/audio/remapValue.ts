/**
 * Linear remap from [inMin, inMax] to [outMin, outMax] with clamp to [0, 1] in normalized space.
 * Shared by live uniforms, offline worker analysis, and Tier A curve patch (tasks 03+).
 */
export function remapValue(
  value: number | undefined | null,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  if (value === undefined || value === null) return (outMin + outMax) / 2;
  const range = inMax - inMin;
  const normalized = range !== 0 ? (value - inMin) / range : 0;
  const clamped = Math.max(0, Math.min(1, normalized));
  return outMin + clamped * (outMax - outMin);
}
