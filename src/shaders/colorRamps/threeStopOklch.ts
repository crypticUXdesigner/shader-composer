import { oklchToRgb } from './oklchToRgb';

/** One OKLCH stop along the ramp parameter t ∈ [0,1]. */
export interface OklchStop {
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly t: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Shortest-path hue interpolation (matches `interpolateHue` in color-system-color-map when reverseHue = 0).
 */
export function interpolateHueShortestPath(startH: number, endH: number, u: number): number {
  let adjustedEnd = endH;
  if (endH < startH) adjustedEnd = endH + 360;
  let h = startH + (adjustedEnd - startH) * u;
  h = ((h % 360) + 360) % 360;
  return h;
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/**
 * Piecewise linear ramp across three OKLCH stops (t0 ≤ t1 ≤ t2).
 * L and C linear in segment parameter; hue uses shortest arc per segment.
 */
export function sampleThreeStopOklch(stops: readonly [OklchStop, OklchStop, OklchStop], t: number): [number, number, number] {
  const [s0, s1, s2] = stops;
  const x = clamp01(t);
  if (x <= s0.t) return oklchToRgb(s0.l, s0.c, s0.h);
  if (x >= s2.t) return oklchToRgb(s2.l, s2.c, s2.h);

  let a: OklchStop;
  let b: OklchStop;
  if (x <= s1.t) {
    a = s0;
    b = s1;
  } else {
    a = s1;
    b = s2;
  }
  const span = b.t - a.t;
  const u = span <= 0 ? 0 : (x - a.t) / span;
  const l = lerp(a.l, b.l, u);
  const c = lerp(a.c, b.c, u);
  const h = interpolateHueShortestPath(a.h, b.h, u);
  return oklchToRgb(l, c, h);
}

/** Default “great out of the box” 3-stop ramp for Color Gradient previews / tests. */
export const DEFAULT_COLOR_GRADIENT_STOPS: readonly [OklchStop, OklchStop, OklchStop] = [
  { l: 0.05, c: 0.12, h: 280, t: 0 },
  { l: 0.55, c: 0.18, h: 200, t: 0.5 },
  { l: 0.92, c: 0.14, h: 55, t: 1 },
] as const;
