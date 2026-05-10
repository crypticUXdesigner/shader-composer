/**
 * WGSL programs for `WebGpuPassPlan` kind `pass.glow-bloom.v1`.
 *
 * Pipeline:
 *   1. input WGSL renders the upstream graph to an offscreen source texture.
 *   2. threshold WGSL extracts bright pixels.
 *   3. blur WGSL runs a one-iteration separable Gaussian blur over the bright texture.
 *   4. combine WGSL adds the blurred glow back onto the original source texture.
 *
 * Runtime globals:
 * - v0 = (time, timelineTime, width, height)
 * - v1 = (threshold, intensity, radius, strength)
 */

const FULLSCREEN_VERTEX_WGSL = `
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
`;

export const GLOW_BLOOM_THRESHOLD_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var sourceTex : texture_2d<f32>;
@group(0) @binding(3) var sourceSamp : sampler;

${FULLSCREEN_VERTEX_WGSL}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let color = textureSample(sourceTex, sourceSamp, in.uv);
  let threshold = clamp(globals.v1.x, 0.0, 1.0);
  let intensity = max(globals.v1.y, 0.0);
  let bright = max(max(color.r, color.g), color.b);
  let mask = max(0.0, bright - threshold) * intensity;
  return vec4<f32>(color.rgb * mask, color.a);
}
`;

export const GLOW_BLOOM_BLUR_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var bloomInputTex : texture_2d<f32>;
@group(0) @binding(3) var bloomInputSamp : sampler;

${FULLSCREEN_VERTEX_WGSL}

fn gaussianWeight(i : f32, s : f32) -> f32 {
  let denom = max(2.0 * s * s, 1e-4);
  return exp(-(i * i) / denom);
}

const MAX_TAPS : i32 = 16;

fn sampleBloomBlur(uv : vec2<f32>, dir : vec2<f32>) -> vec4<f32> {
  let res = max(globals.v0.zw, vec2<f32>(1.0, 1.0));
  let texel = vec2<f32>(1.0, 1.0) / res;
  let sigma = max(globals.v1.z, 1e-3);
  let rTaps = clamp(i32(ceil(min(sigma * 3.0, f32(MAX_TAPS)))), 0, MAX_TAPS);

  var weightSum = gaussianWeight(0.0, sigma);
  var colorSum = textureSample(bloomInputTex, bloomInputSamp, uv) * weightSum;
  let stepVec = dir * texel;

  for (var i = 1; i <= MAX_TAPS; i = i + 1) {
    if (i > rTaps) { break; }
    let w = gaussianWeight(f32(i), sigma);
    let off = stepVec * f32(i);
    colorSum = colorSum + textureSample(bloomInputTex, bloomInputSamp, uv + off) * w;
    colorSum = colorSum + textureSample(bloomInputTex, bloomInputSamp, uv - off) * w;
    weightSum = weightSum + 2.0 * w;
  }

  return colorSum / max(weightSum, 1e-4);
}

@fragment
fn fsBlurH(in : VsOut) -> @location(0) vec4<f32> {
  return sampleBloomBlur(in.uv, vec2<f32>(1.0, 0.0));
}

@fragment
fn fsBlurV(in : VsOut) -> @location(0) vec4<f32> {
  return sampleBloomBlur(in.uv, vec2<f32>(0.0, 1.0));
}
`;

export const GLOW_BLOOM_COMBINE_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var sourceTex : texture_2d<f32>;
@group(0) @binding(2) var bloomTex : texture_2d<f32>;
@group(0) @binding(3) var bloomSamp : sampler;

${FULLSCREEN_VERTEX_WGSL}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let source = textureSample(sourceTex, bloomSamp, in.uv);
  let bloom = textureSample(bloomTex, bloomSamp, in.uv);
  let strength = max(globals.v1.w, 0.0);
  return vec4<f32>(clamp(source.rgb + bloom.rgb * strength, vec3<f32>(0.0), vec3<f32>(1.0)), source.a);
}
`;
