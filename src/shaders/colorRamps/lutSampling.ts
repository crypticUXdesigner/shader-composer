import { LUT_PRESET_SIZE, getAllLutPresetTablesFlat } from './lutPresets';

const LUT_TABLES = getAllLutPresetTablesFlat();
const FLOATS_PER_PRESET = LUT_PRESET_SIZE * 3;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Shape scalar t before LUT sample: optional reverse, gamma, contrast (pivot 0.5).
 */
export function applyLutT(
  t: number,
  reverse: number,
  gamma: number,
  contrast: number
): number {
  let u = clamp01(t);
  if (reverse > 0.5) u = 1 - u;
  if (Math.abs(gamma - 1) > 1e-4) u = Math.pow(u, gamma);
  u = (u - 0.5) * contrast + 0.5;
  return clamp01(u);
}

/** Scale RGB by intensity and clamp to 0–1. */
export function applyIntensity(rgb: [number, number, number], intensity: number): [number, number, number] {
  return [clamp01(rgb[0] * intensity), clamp01(rgb[1] * intensity), clamp01(rgb[2] * intensity)];
}

/**
 * Sample preset LUT at t ∈ [0,1] with linear interpolation between adjacent RGB samples.
 */
export function sampleLut(presetIndex: number, t: number): [number, number, number] {
  const u = clamp01(t);
  const ft = u * (LUT_PRESET_SIZE - 1);
  const i0 = Math.min(Math.floor(ft), LUT_PRESET_SIZE - 1);
  const i1 = Math.min(i0 + 1, LUT_PRESET_SIZE - 1);
  const f = ft - i0;
  const base = presetIndex * FLOATS_PER_PRESET;
  const o0 = base + i0 * 3;
  const o1 = base + i1 * 3;
  return [
    LUT_TABLES[o0] + (LUT_TABLES[o1] - LUT_TABLES[o0]) * f,
    LUT_TABLES[o0 + 1] + (LUT_TABLES[o1 + 1] - LUT_TABLES[o0 + 1]) * f,
    LUT_TABLES[o0 + 2] + (LUT_TABLES[o1 + 2] - LUT_TABLES[o0 + 2]) * f,
  ];
}

/** Full LUT path: shape t, sample preset, optional intensity scale. */
export function sampleLutWithModifiers(
  presetIndex: number,
  t: number,
  reverse: number,
  gamma: number,
  contrast: number,
  intensity: number
): [number, number, number] {
  const shaped = applyLutT(t, reverse, gamma, contrast);
  const rgb = sampleLut(presetIndex, shaped);
  return applyIntensity(rgb, intensity);
}
