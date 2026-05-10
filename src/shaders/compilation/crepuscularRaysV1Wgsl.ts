/**
 * WGSL programs for `WebGpuPassPlan` kind `pass.crepuscular-rays.v1`.
 *
 * Pipeline (4 passes):
 *   1. `inputWgsl` (fullscreen fragment) -> source texture (the upstream subgraph color image)
 *   2. `occluderWgsl` (luminance × angular ray-stripe pattern from the source point) -> mask texture
 *   3. `sweepWgsl` (radial march from each fragment toward the source point, accumulating mask
 *      samples with per-step decay) -> rays texture
 *   4. `combineWgsl` (source.rgb + rays * intensity) -> swapchain / export target
 *
 * Runtime globals layout (must match `crepuscularRaysPassPlanRuntime.ts`):
 * - v0 = (time, timelineTime, width, height)
 * - v1 = (sourceX, sourceY, distanceFalloff, intensity)
 * - v2 = (rayCount, spread, width, 0)
 * - v3 = (rotationSpeed, rotationOffset, 0, 0)
 *
 * Bindings shared by occluder/sweep/combine passes:
 *  - @group(0) @binding(0) globals : Globals (uniform)
 *  - @group(0) @binding(1) params  : array<vec4<f32>> (read-only storage; not used by these passes
 *    but kept so the bind group layout matches `pass.glow-bloom.v1` / blur runtime conventions).
 *  - @group(0) @binding(2) inputTex (texture_2d<f32>)
 *  - @group(0) @binding(3) inputSamp (sampler)
 *
 * Combine pass extends with binding(4) = original source texture so the combine fragment can mix
 * source + rays without re-running the whole pipeline.
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

const GLOBALS_DECL_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
  v3 : vec4<f32>,
}
`;

/** Maximum samples for the radial march. Bounded so WGSL backends accept the loop. */
const RADIAL_MARCH_SAMPLES = 32;

/**
 * Occluder pass: extract input luminance and modulate by the procedural angular ray-stripe pattern,
 * so the sweep pass effectively integrates only "light through stripes" along its march.
 */
export const CREPUSCULAR_RAYS_OCCLUDER_WGSL = `
${GLOBALS_DECL_WGSL}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var sourceTex : texture_2d<f32>;
@group(0) @binding(3) var sourceSamp : sampler;

${FULLSCREEN_VERTEX_WGSL}

const PI : f32 = 3.141592653589793;
const TAU : f32 = 6.283185307179586;

fn raySource() -> vec2<f32> {
  return vec2<f32>(0.5, 0.5) + 0.5 * vec2<f32>(globals.v1.x, globals.v1.y);
}

/**
 * Procedural angular ray pattern at a point (mirrors the WebGL formulation).
 * Returns 0..1 ray density (1 = stripe centerline, 0 = between stripes / outside spread).
 */
fn rayStripes(uv : vec2<f32>) -> f32 {
  let src = raySource();
  let d = uv - src;
  let dist = length(d);
  let rotationSpeed = globals.v3.x;
  let rotationOffset = globals.v3.y;
  let angleOffset = (rotationOffset + globals.v0.x * rotationSpeed) * TAU;
  let angle = atan2(d.y, d.x) + angleOffset;
  let angleNorm = (((angle / TAU) - floor(angle / TAU)) * 1.0 + 0.0); // 0..1 within full turn
  let spreadDeg = max(globals.v2.y, 1.0);
  let spreadNorm = clamp(spreadDeg / 360.0, 0.001, 1.0);
  if (angleNorm > spreadNorm) { return 0.0; }
  let rayCount = max(globals.v2.x, 2.0);
  let width = clamp(globals.v2.z, 0.001, 0.5);
  let s = (angleNorm / spreadNorm) * rayCount;
  let t = s - floor(s);
  let distFromCenter = min(t, 1.0 - t) * 2.0;
  let edge = 1.0 - smoothstep(width, width + 0.05, distFromCenter);
  // Soft falloff to keep the pattern from clipping hard at the spread boundary or near the source.
  let near = smoothstep(0.0, 0.02, dist);
  return edge * near;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let color = textureSample(sourceTex, sourceSamp, in.uv);
  let luma = dot(clamp(color.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(0.2126, 0.7152, 0.0722));
  let stripes = rayStripes(in.uv);
  let mask = clamp(luma * stripes, 0.0, 1.0);
  return vec4<f32>(color.rgb * mask, mask);
}
`;

/**
 * Radial sweep pass: for each fragment, march from the fragment toward the source point in a
 * fixed number of steps (${RADIAL_MARCH_SAMPLES}), accumulating the masked color with a per-step
 * exponential decay derived from `distanceFalloff`. Output rgb is the integrated light;
 * alpha is the integrated mask weight (debug aid, not used by combine).
 */
export const CREPUSCULAR_RAYS_SWEEP_WGSL = `
${GLOBALS_DECL_WGSL}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var maskTex : texture_2d<f32>;
@group(0) @binding(3) var maskSamp : sampler;

${FULLSCREEN_VERTEX_WGSL}

const SAMPLES : i32 = ${RADIAL_MARCH_SAMPLES};

fn raySource() -> vec2<f32> {
  return vec2<f32>(0.5, 0.5) + 0.5 * vec2<f32>(globals.v1.x, globals.v1.y);
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let src = raySource();
  let toSrc = src - in.uv;
  let dist = length(toSrc);
  let stepVec = toSrc / f32(SAMPLES);

  // Per-step decay derived from distanceFalloff; map [0..5] -> [1..0.6] roughly so far rays stay visible.
  let falloffParam = max(globals.v1.z, 0.0);
  let decay = clamp(exp(-falloffParam * dist / f32(SAMPLES)), 0.0, 1.0);

  var weight = 1.0;
  var accum = vec3<f32>(0.0);
  for (var i = 0; i < SAMPLES; i = i + 1) {
    let p = in.uv + stepVec * f32(i);
    let s = textureSample(maskTex, maskSamp, p);
    accum = accum + s.rgb * weight;
    weight = weight * decay;
  }

  let normalized = accum / f32(SAMPLES);
  return vec4<f32>(normalized, 1.0);
}
`;

/**
 * Combine pass: source.rgb + rays.rgb * intensity (clamped to [0,1] so we don't overwhelm tone-mapping
 * downstream). Source alpha is preserved.
 */
export const CREPUSCULAR_RAYS_COMBINE_WGSL = `
${GLOBALS_DECL_WGSL}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var sourceTex : texture_2d<f32>;
@group(0) @binding(2) var raysTex : texture_2d<f32>;
@group(0) @binding(3) var samp : sampler;

${FULLSCREEN_VERTEX_WGSL}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let src = textureSample(sourceTex, samp, in.uv);
  let rays = textureSample(raysTex, samp, in.uv);
  let intensity = max(globals.v1.w, 0.0);
  let lit = clamp(src.rgb + rays.rgb * intensity, vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(lit, src.a);
}
`;
