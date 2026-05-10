/**
 * WGSL programs for `WebGpuPassPlan` kind `pass.blur.gaussian-separable.v1`.
 *
 * Layout contract (must match `blurGaussianSeparablePassPlanRuntime.ts`):
 *
 * `blurWgsl` bind group 0:
 * - binding(0) `globals` uniform (v0 = time/timelineTime/width/height, v1/v2 = blur params)
 * - binding(1) `params` storage `array<vec4<f32>>` (the global compiled-graph params buffer)
 * - binding(2) `blurInputTex` (texture_2d<f32>)
 * - binding(3) `blurInputSamp` (sampler)
 *
 * `presentWgsl` bind group 0:
 * - binding(0) `presentTex` (texture_2d<f32>)
 * - binding(1) `presentSamp` (sampler)
 *
 * The runtime supplies blur params via `globals.v1` / `globals.v2` so that the pass plan does not
 * need to know the global param layout indices for the blur node:
 *   v1.x = amount    (0..1)
 *   v1.y = radius    (0..20)  — gaussian sigma in pixels
 *   v1.z = direction (degrees)
 *   v1.w = type      (0=gaussian, 1=directional, 2=radial)
 *   v2.x = centerX   (-2..2)   — mapped to UV via `0.5 + 0.5 * center`
 *   v2.y = centerY   (-2..2)
 */

export const BLUR_GAUSSIAN_SEPARABLE_BLUR_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var blurInputTex : texture_2d<f32>;
@group(0) @binding(3) var blurInputSamp : sampler;

struct VsOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

@vertex
fn vs(@builtin(vertex_index) vid : u32) -> VsOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var o : VsOut;
  o.pos = vec4<f32>(p[vid], 0.0, 1.0);
  o.uv = (o.pos.xy * 0.5) + vec2<f32>(0.5, 0.5);
  return o;
}

/**
 * Gaussian weight for the discrete tap at integer offset i with sigma s.
 * Bounded loop count keeps WGSL friendly for all backends.
 */
fn gaussianWeight(i : f32, s : f32) -> f32 {
  let denom = max(2.0 * s * s, 1e-4);
  return exp(-(i * i) / denom);
}

const MAX_TAPS : i32 = 16;

fn safeNormalize(v : vec2<f32>, fallback : vec2<f32>) -> vec2<f32> {
  let d2 = dot(v, v);
  if (d2 < 1e-8) { return fallback; }
  return v * inverseSqrt(d2);
}

fn blurDirFor(uv : vec2<f32>) -> vec2<f32> {
  let blurType = globals.v1.w;
  // 0 = gaussian separable (caller supplies axis dirs)
  if (blurType < 0.5) {
    return vec2<f32>(0.0, 0.0);
  }

  // 1 = directional (angle in degrees)
  if (blurType < 1.5) {
    let a = globals.v1.z * 0.017453292519943295; // PI / 180
    return safeNormalize(vec2<f32>(cos(a), sin(a)), vec2<f32>(1.0, 0.0));
  }

  // 2 = radial (direction points away from center)
  let c = vec2<f32>(0.5, 0.5) + 0.5 * vec2<f32>(globals.v2.x, globals.v2.y);
  return safeNormalize(uv - c, vec2<f32>(1.0, 0.0));
}

fn sampleSeparable(uv : vec2<f32>, dir : vec2<f32>, amount : f32, radius : f32) -> vec4<f32> {
  let res = max(globals.v0.zw, vec2<f32>(1.0, 1.0));
  let texel = vec2<f32>(1.0, 1.0) / res;
  let stepVec = dir * texel;

  // Sigma in pixels — when amount = 0, fall through to the unblurred input.
  let sigma = max(radius * clamp(amount, 0.0, 1.0), 1e-3);
  // Tap radius scales with sigma (3 sigmas covers ~99% of the kernel weight).
  let rTaps = clamp(i32(ceil(min(sigma * 3.0, f32(MAX_TAPS)))), 0, MAX_TAPS);

  var weightSum = gaussianWeight(0.0, sigma);
  var colorSum = textureSample(blurInputTex, blurInputSamp, uv) * weightSum;

  for (var i = 1; i <= MAX_TAPS; i = i + 1) {
    if (i > rTaps) { break; }
    let w = gaussianWeight(f32(i), sigma);
    let off = stepVec * f32(i);
    colorSum = colorSum + textureSample(blurInputTex, blurInputSamp, uv + off) * w;
    colorSum = colorSum + textureSample(blurInputTex, blurInputSamp, uv - off) * w;
    weightSum = weightSum + 2.0 * w;
  }

  let blurred = colorSum / max(weightSum, 1e-4);
  // Output blends between blurred and original by amount, so amount=0 acts as identity.
  let original = textureSample(blurInputTex, blurInputSamp, uv);
  return mix(original, blurred, clamp(amount, 0.0, 1.0));
}

@fragment
fn fsBlurH(in : VsOut) -> @location(0) vec4<f32> {
  let amount = globals.v1.x;
  let radius = globals.v1.y;
  let blurType = globals.v1.w;
  let dir = select(vec2<f32>(1.0, 0.0), blurDirFor(in.uv), blurType > 0.5);
  return sampleSeparable(in.uv, dir, amount, radius);
}

@fragment
fn fsBlurV(in : VsOut) -> @location(0) vec4<f32> {
  let amount = globals.v1.x;
  let radius = globals.v1.y;
  let blurType = globals.v1.w;
  let dir = select(vec2<f32>(0.0, 1.0), blurDirFor(in.uv), blurType > 0.5);
  return sampleSeparable(in.uv, dir, amount, radius);
}
`;

export const BLUR_GAUSSIAN_SEPARABLE_PRESENT_WGSL = `
@group(0) @binding(0) var presentTex : texture_2d<f32>;
@group(0) @binding(1) var presentSamp : sampler;

struct VsOut {
  @builtin(position) pos : vec4<f32>,
  @location(0) uv : vec2<f32>,
}

@vertex
fn vs(@builtin(vertex_index) vid : u32) -> VsOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var o : VsOut;
  o.pos = vec4<f32>(p[vid], 0.0, 1.0);
  o.uv = (o.pos.xy * 0.5) + vec2<f32>(0.5, 0.5);
  return o;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  return textureSample(presentTex, presentSamp, in.uv);
}
`;
