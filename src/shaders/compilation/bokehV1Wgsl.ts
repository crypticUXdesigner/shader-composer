export const BOKEH_THRESHOLD_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

// v0: (time, timelineTime, width, height)
// v1: (threshold, intensity, radiusPx, strength)
// v2: (blades, rotationDeg, _, _)
@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var sourceTex : texture_2d<f32>;
@group(0) @binding(3) var sourceSamp : sampler;

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

// Threshold pass reads the fullscreen render from pass 1 (same bindings as glow-bloom threshold).
@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let src = textureSample(sourceTex, sourceSamp, in.uv);
  // Luma-based bright-pass threshold; keeps chroma by scaling RGB.
  let l = dot(src.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let t = globals.v1.x;
  let intensity = globals.v1.y;
  let k = max(0.0, l - t) * intensity;
  return vec4<f32>(src.rgb * k, 1.0);
}
`;

export const BOKEH_BLUR_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

// v0: (time, timelineTime, width, height)
// v1: (threshold, intensity, radiusPx, strength)
// v2: (blades, rotationDeg, _, _)
@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> params : array<vec4<f32>>;
@group(0) @binding(2) var bokehInputTex : texture_2d<f32>;
@group(0) @binding(3) var bokehInputSamp : sampler;

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

fn rot2(v : vec2<f32>, a : f32) -> vec2<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec2<f32>(c * v.x - s * v.y, s * v.x + c * v.y);
}

// Returns a per-angle radius scale for an N-gon aperture (>= 3).
fn apertureScale(angle : f32, blades : f32, rotRad : f32) -> f32 {
  let n = max(3.0, blades);
  let a = angle + rotRad;
  let pi = 3.14159265359;
  let sector = (2.0 * pi) / n;
  let half = 0.5 * sector;
  let m = ((a + pi) % sector) - half;
  let denom = max(1e-4, cos(m));
  let numer = cos(half);
  return clamp(numer / denom, 0.25, 4.0);
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  let w = max(1.0, globals.v0.z);
  let h = max(1.0, globals.v0.w);
  let texel = vec2<f32>(1.0 / w, 1.0 / h);
  let radiusPx = max(0.0, globals.v1.z);
  let blades = globals.v2.x;
  let rotRad = globals.v2.y * 3.14159265359 / 180.0;

  // Fixed offset set (deterministic), loosely Poisson-like in [-1,1].
  var offsets = array<vec2<f32>, 16>(
    vec2<f32>(-0.613, -0.332),
    vec2<f32>(-0.163, -0.905),
    vec2<f32>( 0.205, -0.593),
    vec2<f32>( 0.497, -0.190),
    vec2<f32>( 0.823, -0.461),
    vec2<f32>( 0.934,  0.112),
    vec2<f32>( 0.437,  0.322),
    vec2<f32>( 0.143,  0.918),
    vec2<f32>(-0.258,  0.626),
    vec2<f32>(-0.902,  0.420),
    vec2<f32>(-0.742,  0.020),
    vec2<f32>(-0.374,  0.174),
    vec2<f32>( 0.014, -0.180),
    vec2<f32>( 0.285,  0.012),
    vec2<f32>(-0.090,  0.260),
    vec2<f32>( 0.060, -0.038)
  );

  let uv = in.uv;
  var acc = vec3<f32>(0.0);
  var wsum = 0.0;

  // Center sample keeps highlights stable when radius is small.
  let c0 = textureSample(bokehInputTex, bokehInputSamp, uv).rgb;
  acc += c0;
  wsum += 1.0;

  for (var i = 0u; i < 16u; i = i + 1u) {
    let o = offsets[i];
    let angle = atan2(o.y, o.x);
    let s = apertureScale(angle, blades, rotRad);
    let r = radiusPx * s;
    let d = length(o);
    // Soft aperture edge; weight fades out at the aperture boundary.
    let wgt = smoothstep(1.0, 0.0, d);
    let duv = rot2(o, rotRad) * (r * texel);
    let col = textureSample(bokehInputTex, bokehInputSamp, uv + duv).rgb;
    acc += col * wgt;
    wsum += wgt;
  }

  let outRgb = acc / max(1e-4, wsum);
  return vec4<f32>(outRgb, 1.0);
}
`;

export const BOKEH_COMBINE_WGSL = `
struct Globals {
  v0 : vec4<f32>,
  v1 : vec4<f32>,
  v2 : vec4<f32>,
}

// v0: (time, timelineTime, width, height)
// v1: (threshold, intensity, radiusPx, strength)
// v2: (blades, rotationDeg, _, _)
@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var sourceTex : texture_2d<f32>;
@group(0) @binding(2) var blurTex : texture_2d<f32>;
@group(0) @binding(3) var sourceSamp : sampler;

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
  let src = textureSample(sourceTex, sourceSamp, in.uv).rgb;
  let b = textureSample(blurTex, sourceSamp, in.uv).rgb;
  let strength = globals.v1.w;
  return vec4<f32>(src + b * strength, 1.0);
}
`;

