/**
 * Color map preview: JS mirror of shader logic for OKLCH color map nodes.
 * Used to render the color-stops strip (stepped or gradient) in the node UI.
 */

import { oklchToCssRgb } from './colorConversion';

/** Cubic bezier curve: [x1, y1, x2, y2] (control points). */
export type BezierCurve = [number, number, number, number];

/** Evaluate cubic bezier at x (0–1). Matches shader cubicBezier. */
export function cubicBezier(x: number, curve: BezierCurve): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const [cx1, cy1, cx2, cy2] = curve;
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 10; i++) {
    const t = (t0 + t1) / 2;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const xt = 3 * uu * t * cx1 + 3 * u * tt * cx2 + tt * t;
    if (xt < x) t0 = t;
    else t1 = t;
  }
  const t = (t0 + t1) / 2;
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return 3 * uu * t * cy1 + 3 * u * tt * cy2 + tt * t;
}

/** Interpolate hue with wrapping. reverseHue: 0 = normal, 1 = reverse direction. */
export function interpolateHue(startH: number, endH: number, t: number, reverseHue: number): number {
  let adjustedEndH: number;
  if (reverseHue > 0) {
    adjustedEndH = endH > startH ? endH - 360 : endH;
  } else {
    adjustedEndH = endH < startH ? endH + 360 : endH;
  }
  let h = startH + (adjustedEndH - startH) * t;
  h = ((h % 360) + 360) % 360;
  if (h < 0) h += 360;
  return h;
}

/** Generate one color stop at t (0–1). Returns OKLCH { l, c, h }. */
export function generateColorStop(
  t: number,
  startL: number,
  startC: number,
  startH: number,
  endL: number,
  endC: number,
  endH: number,
  lCurve: BezierCurve,
  cCurve: BezierCurve,
  hCurve: BezierCurve,
  reverseHue: number
): { l: number; c: number; h: number } {
  const lT = cubicBezier(t, lCurve);
  const cT = cubicBezier(t, cCurve);
  const hT = cubicBezier(t, hCurve);
  const l = startL + (endL - startL) * lT;
  const c = startC + (endC - startC) * cT;
  const h = interpolateHue(startH, endH, hT, reverseHue);
  return { l, c, h };
}

/** Get CSS color string for a stop. */
export function colorStopToCss(
  t: number,
  startL: number,
  startC: number,
  startH: number,
  endL: number,
  endC: number,
  endH: number,
  lCurve: BezierCurve,
  cCurve: BezierCurve,
  hCurve: BezierCurve,
  reverseHue: number
): string {
  const { l, c, h } = generateColorStop(
    t,
    startL,
    startC,
    startH,
    endL,
    endC,
    endH,
    lCurve,
    cCurve,
    hCurve,
    reverseHue
  );
  return oklchToCssRgb(l, c, h);
}

/** Build curve tuple from param object (x1, y1, x2, y2). */
export function getCurveFromParams(
  params: Record<string, unknown>,
  prefix: string
): BezierCurve {
  const x1 = Number(params[`${prefix}X1`] ?? 0);
  const y1 = Number(params[`${prefix}Y1`] ?? 0);
  const x2 = Number(params[`${prefix}X2`] ?? 1);
  const y2 = Number(params[`${prefix}Y2`] ?? 1);
  return [x1, y1, x2, y2];
}
