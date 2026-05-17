import { emitColorGradientValueWgsl } from './colorGradientValue';
import { getAllLutPresetTablesFlat, getLutPresetCount, getLutPresetRgbFlat } from './lutPresets';

import { LUT_RGB_FLOATS_PER_PRESET } from './lutPresetData.generated';

import { lutGlslPresetSuffix } from './emitGlsl';



const PREFIX = 'cr_';



function clampPresetIndex(presetIndex: number): number {

  const max = getLutPresetCount() - 1;

  return Math.max(0, Math.min(max, Math.round(presetIndex)));

}



/** Baked WGSL sampler name for a preset index (e.g. `cr_sample_lut_p0`). */

export function lutWgslSampleFunctionName(presetIndex: number): string {

  return `${PREFIX}sample_lut${lutGlslPresetSuffix(presetIndex)}`;

}



function formatWgslFloatArray(values: readonly number[], name: string): string {

  const lines: string[] = [];

  for (let i = 0; i < values.length; i += 6) {

    const chunk = values.slice(i, i + 6).map((v) => `${v.toFixed(6)}f`);

    lines.push(`  ${chunk.join(', ')}`);

  }

  return `const ${name}: array<f32, ${values.length}> = array<f32, ${values.length}>(\n${lines.join(',\n')}\n);`;

}



function emitLutWgslSharedHelpers(): string {

  return `

fn ${PREFIX}apply_lut_t(t: f32, reverse: f32, gamma: f32, contrast: f32) -> f32 {

  var u = clamp(t, 0.0, 1.0);

  if (reverse > 0.5) { u = 1.0 - u; }

  if (abs(gamma - 1.0) > 0.0001) { u = pow(u, gamma); }

  u = (u - 0.5) * contrast + 0.5;

  return clamp(u, 0.0, 1.0);

}



fn ${PREFIX}apply_intensity(rgb: vec3<f32>, intensity: f32) -> vec3<f32> {

  return clamp(rgb * intensity, vec3<f32>(0.0), vec3<f32>(1.0));

}`.trim();

}



/** All presets in one atlas + runtime preset index (Color LUT node). */

function emitLutWgslFunctionsAllPresets(): string {

  const flat = getAllLutPresetTablesFlat();

  const presetMax = getLutPresetCount() - 1;

  const tableName = `${PREFIX}lut_tables`;

  return `

${formatWgslFloatArray(flat, tableName)}



${emitLutWgslSharedHelpers()}



fn ${PREFIX}sample_lut(preset: i32, t: f32) -> vec3<f32> {

  let u = clamp(t, 0.0, 1.0);

  let p = clamp(preset, 0, ${presetMax});

  let ft = u * 255.0;

  let i0 = i32(floor(ft));

  let i1 = min(i0 + 1, 255);

  let f = fract(ft);

  let base = p * ${LUT_RGB_FLOATS_PER_PRESET};

  let o0 = base + i0 * 3;

  let o1 = base + i1 * 3;

  let c0 = vec3<f32>(${tableName}[o0], ${tableName}[o0 + 1], ${tableName}[o0 + 2]);

  let c1 = vec3<f32>(${tableName}[o1], ${tableName}[o1 + 1], ${tableName}[o1 + 2]);

  return mix(c0, c1, f);

}

`.trim();

}



/** LUT table + sampling helpers for one baked preset. */

function emitLutWgslFunctionsForPreset(presetIndex: number): string {

  const preset = clampPresetIndex(presetIndex);

  const suffix = lutGlslPresetSuffix(preset);

  const flat = getLutPresetRgbFlat(preset);

  const tableName = `${PREFIX}lut_tables${suffix}`;

  const sampleFn = `${PREFIX}sample_lut${suffix}`;

  return `

${formatWgslFloatArray(flat, tableName)}



${emitLutWgslSharedHelpers()}



fn ${sampleFn}(t: f32) -> vec3<f32> {

  let u = clamp(t, 0.0, 1.0);

  let ft = u * 255.0;

  let i0 = i32(floor(ft));

  let i1 = min(i0 + 1, 255);

  let f = fract(ft);

  let o0 = i0 * 3;

  let o1 = i1 * 3;

  let c0 = vec3<f32>(${tableName}[o0], ${tableName}[o0 + 1], ${tableName}[o0 + 2]);

  let c1 = vec3<f32>(${tableName}[o1], ${tableName}[o1 + 1], ${tableName}[o1 + 2]);

  return mix(c0, c1, f);

}

`.trim();

}



/**

 * LUT helpers for WGSL. Omit `presetIndex` for all presets + `cr_sample_lut(preset, t)`;

 * pass an index to bake a single preset table (smaller shader).

 */

export function emitLutWgslFunctions(presetIndex?: number): string {

  if (presetIndex === undefined) {

    return emitLutWgslFunctionsAllPresets();

  }

  return emitLutWgslFunctionsForPreset(presetIndex);

}



/** 3-stop OKLCH ramp helpers for WGSL. */

export function emitThreeStopWgslFunctions(): string {

  return `

fn ${PREFIX}oklch_to_rgb(oklch: vec3<f32>) -> vec3<f32> {

  let l = oklch.x;

  let c = oklch.y;

  let h = oklch.z * 3.14159265359 / 180.0;

  let a = c * cos(h);

  let b = c * sin(h);

  let l_ = l + 0.3963377774 * a + 0.2158037573 * b;

  let m_ = l - 0.1055613458 * a - 0.0638541728 * b;

  let s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  let l3 = l_ * l_ * l_;

  let m3 = m_ * m_ * m_;

  let s3 = s_ * s_ * s_;

  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;

  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;

  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  return clamp(vec3<f32>(r, g, bl), vec3<f32>(0.0), vec3<f32>(1.0));

}



fn ${PREFIX}interpolate_hue(startH: f32, endH: f32, u: f32) -> f32 {

  let adjustedEndH = select(endH, endH + 360.0, endH < startH);

  var h = mix(startH, adjustedEndH, u);

  h = h - floor(h / 360.0) * 360.0;

  if (h < 0.0) { h = h + 360.0; }

  return h;

}



fn ${PREFIX}sample_three_stop_oklch(

  ok0: vec3<f32>, t0: f32,

  ok1: vec3<f32>, t1: f32,

  ok2: vec3<f32>, t2: f32,

  t: f32

) -> vec3<f32> {

  let x = clamp(t, 0.0, 1.0);

  if (x <= t0) { return ${PREFIX}oklch_to_rgb(ok0); }

  if (x >= t2) { return ${PREFIX}oklch_to_rgb(ok2); }

  var a: vec3<f32>;

  var b: vec3<f32>;

  var ta: f32;

  var tb: f32;

  if (x <= t1) {

    a = ok0; b = ok1; ta = t0; tb = t1;

  } else {

    a = ok1; b = ok2; ta = t1; tb = t2;

  }

  let span = max(tb - ta, 0.00001);

  let u = (x - ta) / span;

  let l = mix(a.x, b.x, u);

  let c = mix(a.y, b.y, u);

  let h = ${PREFIX}interpolate_hue(a.z, b.z, u);

  return ${PREFIX}oklch_to_rgb(vec3<f32>(l, c, h));

}

${emitColorGradientValueWgsl()}
`.trim();

}



export function emitColorRampsWgslFunctions(lutPresetIndex = 0): string {

  return `${emitLutWgslFunctions(lutPresetIndex)}\n\n${emitThreeStopWgslFunctions()}`;

}


