/** Below this, value softness is a no-op (passthrough after gain/power). */
export const COLOR_GRADIENT_VALUE_SOFTNESS_EPS = 1e-4;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** GLSL/WGSL-compatible smoothstep(edge0, edge1, x) for edge0 < edge1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Shape Color Gradient **Value** input: clamp, gain, power, optional black-end knee.
 * Softness multiplies by smoothstep(0, softness, v) so upstream masks (e.g. Gradient) keep their falloff.
 */
export function applyColorGradientValue(
  value: number,
  gain: number,
  power: number,
  softness: number
): number {
  let v = clamp01(value);
  v = Math.pow(v * gain, power);
  if (softness <= COLOR_GRADIENT_VALUE_SOFTNESS_EPS) return v;
  return v * smoothstep(0, softness, v);
}

const PREFIX = 'cr_';

export function emitColorGradientValueGlsl(): string {
  return `
float ${PREFIX}apply_color_gradient_value(float v, float gain, float power, float softness) {
  v = clamp(v, 0.0, 1.0);
  v = pow(v * gain, power);
  if (softness <= ${COLOR_GRADIENT_VALUE_SOFTNESS_EPS}) {
    return v;
  }
  return v * smoothstep(0.0, softness, v);
}
`.trim();
}

export function emitColorGradientValueWgsl(): string {
  return `
fn ${PREFIX}apply_color_gradient_value(v: f32, gain: f32, power: f32, softness: f32) -> f32 {
  var u = clamp(v, 0.0, 1.0);
  u = pow(u * gain, power);
  if (softness <= ${COLOR_GRADIENT_VALUE_SOFTNESS_EPS}) {
    return u;
  }
  return u * smoothstep(0.0, softness, u);
}
`.trim();
}
