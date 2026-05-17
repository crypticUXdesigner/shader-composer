import { emitColorGradientValueGlsl } from './colorGradientValue';
import { getAllLutPresetTablesFlat, getLutPresetCount, getLutPresetRgbFlat } from './lutPresets';

import { LUT_RGB_FLOATS_PER_PRESET } from './lutPresetData.generated';



const PREFIX = 'cr_';



function clampPresetIndex(presetIndex: number): number {

  const max = getLutPresetCount() - 1;

  return Math.max(0, Math.min(max, Math.round(presetIndex)));

}



export function lutGlslPresetSuffix(presetIndex: number): string {

  return `_p${clampPresetIndex(presetIndex)}`;

}



/** Placeholder in Color LUT `mainCode`; replaced per node at compile time. */

export const COLOR_LUT_GLSL_SAMPLE_PLACEHOLDER = 'cr_sample_lut_BAKED';



/** Baked GLSL sampler name for a preset index (e.g. `cr_sample_lut_p0`). */

export function lutGlslSampleFunctionName(presetIndex: number): string {

  return `${PREFIX}sample_lut${lutGlslPresetSuffix(presetIndex)}`;

}



function formatGlslFloatArray(values: readonly number[], name: string): string {

  const lines: string[] = [];

  for (let i = 0; i < values.length; i += 6) {

    const chunk = values.slice(i, i + 6).map((v) => v.toFixed(6));

    lines.push(`  ${chunk.join(', ')}`);

  }

  return `const float ${name}[${values.length}] = float[${values.length}](\n${lines.join(',\n')}\n);`;

}



function emitLutGlslSharedHelpers(): string {

  return `

float ${PREFIX}apply_lut_t(float t, float reverse, float gamma, float contrast) {

  float u = clamp(t, 0.0, 1.0);

  if (reverse > 0.5) u = 1.0 - u;

  if (abs(gamma - 1.0) > 0.0001) u = pow(u, gamma);

  u = (u - 0.5) * contrast + 0.5;

  return clamp(u, 0.0, 1.0);

}



vec3 ${PREFIX}apply_intensity(vec3 rgb, float intensity) {

  return clamp(rgb * intensity, 0.0, 1.0);

}`.trim();

}



/** All presets in one atlas + runtime preset index (Color LUT node). */

function emitLutGlslFunctionsAllPresets(): string {

  const flat = getAllLutPresetTablesFlat();

  const presetMax = getLutPresetCount() - 1;

  const tableName = `${PREFIX}lut_tables`;

  return `

${formatGlslFloatArray(flat, tableName)}



${emitLutGlslSharedHelpers()}



vec3 ${PREFIX}sample_lut(int preset, float t) {

  int p = min(max(preset, 0), ${presetMax});

  t = clamp(t, 0.0, 1.0);

  float ft = t * 255.0;

  int i0 = int(floor(ft));

  int i1 = min(i0 + 1, 255);

  float f = fract(ft);

  int base = p * ${LUT_RGB_FLOATS_PER_PRESET};

  int o0 = base + i0 * 3;

  int o1 = base + i1 * 3;

  return mix(

    vec3(${tableName}[o0], ${tableName}[o0 + 1], ${tableName}[o0 + 2]),

    vec3(${tableName}[o1], ${tableName}[o1 + 1], ${tableName}[o1 + 2]),

    f

  );

}

`.trim();

}



/** LUT table + sampling helpers for one baked preset (smaller shader when preset is fixed). */

function emitLutGlslFunctionsForPreset(presetIndex: number): string {

  const preset = clampPresetIndex(presetIndex);

  const suffix = lutGlslPresetSuffix(preset);

  const flat = getLutPresetRgbFlat(preset);

  const tableName = `${PREFIX}lut_tables${suffix}`;

  const sampleFn = `${PREFIX}sample_lut${suffix}`;

  return `

${formatGlslFloatArray(flat, tableName)}



${emitLutGlslSharedHelpers()}



vec3 ${sampleFn}(float t) {

  t = clamp(t, 0.0, 1.0);

  float ft = t * 255.0;

  int i0 = int(floor(ft));

  int i1 = min(i0 + 1, 255);

  float f = fract(ft);

  int o0 = i0 * 3;

  int o1 = i1 * 3;

  return mix(

    vec3(${tableName}[o0], ${tableName}[o0 + 1], ${tableName}[o0 + 2]),

    vec3(${tableName}[o1], ${tableName}[o1 + 1], ${tableName}[o1 + 2]),

    f

  );

}

`.trim();

}



/**

 * LUT helpers for GLSL. Omit `presetIndex` for all presets + `cr_sample_lut(preset, t)`;

 * pass an index to bake a single preset table (smaller shader).

 */

export function emitLutGlslFunctions(presetIndex?: number): string {

  if (presetIndex === undefined) {

    return emitLutGlslFunctionsAllPresets();

  }

  return emitLutGlslFunctionsForPreset(presetIndex);

}



/** 3-stop OKLCH ramp helpers for GLSL (spatial Color Gradient). */

export function emitThreeStopGlslFunctions(): string {

  return `

vec3 ${PREFIX}oklch_to_rgb(vec3 oklch) {

  float l = oklch.x;

  float c = oklch.y;

  float h = oklch.z * 3.14159265359 / 180.0;

  float a = c * cos(h);

  float b = c * sin(h);

  float l_ = l + 0.3963377774 * a + 0.2158037573 * b;

  float m_ = l - 0.1055613458 * a - 0.0638541728 * b;

  float s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  float l3 = l_ * l_ * l_;

  float m3 = m_ * m_ * m_;

  float s3 = s_ * s_ * s_;

  float r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;

  float g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;

  float bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  return clamp(vec3(r, g, bl), 0.0, 1.0);

}



float ${PREFIX}interpolate_hue(float startH, float endH, float u) {

  float adjustedEndH = (endH < startH) ? endH + 360.0 : endH;

  float h = mix(startH, adjustedEndH, u);

  h = mod(h, 360.0);

  if (h < 0.0) h += 360.0;

  return h;

}



vec3 ${PREFIX}sample_three_stop_oklch(

  vec3 ok0, float t0,

  vec3 ok1, float t1,

  vec3 ok2, float t2,

  float t

) {

  t = clamp(t, 0.0, 1.0);

  if (t <= t0) return ${PREFIX}oklch_to_rgb(ok0);

  if (t >= t2) return ${PREFIX}oklch_to_rgb(ok2);

  vec3 a;

  vec3 b;

  float ta;

  float tb;

  if (t <= t1) {

    a = ok0; b = ok1; ta = t0; tb = t1;

  } else {

    a = ok1; b = ok2; ta = t1; tb = t2;

  }

  float span = max(tb - ta, 0.00001);

  float u = (t - ta) / span;

  float l = mix(a.x, b.x, u);

  float c = mix(a.y, b.y, u);

  float h = ${PREFIX}interpolate_hue(a.z, b.z, u);

  return ${PREFIX}oklch_to_rgb(vec3(l, c, h));

}

${emitColorGradientValueGlsl()}
`.trim();

}



/** Combined LUT + 3-stop helpers for nodes that need both. */

export function emitColorRampsGlslFunctions(lutPresetIndex = 0): string {

  return `${emitLutGlslFunctions(lutPresetIndex)}\n\n${emitThreeStopGlslFunctions()}`;

}


