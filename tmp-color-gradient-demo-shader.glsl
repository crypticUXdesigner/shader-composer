#version 300 es
precision highp float;

// Global uniforms
uniform vec2 uResolution;
uniform float uTime;
uniform float uTimelineTime;

uniform float unode_gradientAngle;
uniform float unode_gradientCenterX;
uniform float unode_gradientCenterY;
uniform float unode_gradientFalloff;
uniform float unode_gradientIntensity;
uniform float unode_gradientLinearScale;
uniform float unode_gradientRadius;
uniform float unode_gradientStop0C;
uniform float unode_gradientStop0H;
uniform float unode_gradientStop0L;
uniform float unode_gradientStop0T;
uniform float unode_gradientStop1C;
uniform float unode_gradientStop1H;
uniform float unode_gradientStop1L;
uniform float unode_gradientStop1T;
uniform float unode_gradientStop2C;
uniform float unode_gradientStop2H;
uniform float unode_gradientStop2L;
uniform float unode_gradientStop2T;
uniform float unode_gradientValueGain;
uniform float unode_gradientValuePower;
uniform float unode_gradientValueSoftness;
uniform float unode_noiseNoiseGain;
uniform float unode_noiseNoiseIntensity;
uniform float unode_noiseNoiseLacunarity;
uniform float unode_noiseNoiseScale;
uniform float unode_noiseNoiseTimeOffset;
uniform float unode_noiseNoiseTimeSpeed;
uniform int unode_gradientGradientMode;
uniform int unode_noiseNoiseMode;
uniform int unode_noiseNoiseOctaves;

// Global variable declarations (accessible in functions)
vec2 node_node_uv_out = vec2(0.0);
float node_node_noise_out = 0.0;
vec3 node_node_gradient_out = vec3(0.0);

// ----- Simplex 2D -----

float noise_hash(float n) {
  return fract(sin(n) * 43758.5453);
}

vec3 noise_hash3(vec3 v) {
  vec3 p = vec3(dot(v, vec3(127.1, 311.7, 74.7)),
                dot(v, vec3(269.5, 183.3, 246.1)),
                dot(v, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}

float noise_simplex2d(vec2 v, float time) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = noise_hash3(vec3(i.x, i.y, time));
  p = mod(p, 289.0);
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float noise_simplex2d_fbm(vec2 p, float time) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 10; i++) {
    if (float(i) >= float(unode_noiseNoiseOctaves)) break;
    float octaveTime = time * (0.5 + float(i) * 0.2);
    value += amplitude * noise_simplex2d(p * frequency + vec2(octaveTime * 0.1, octaveTime * 0.15), octaveTime);
    frequency *= clamp((unode_noiseNoiseLacunarity), 1.0, 4.0);
    amplitude *= clamp((unode_noiseNoiseGain), 0.1, 1.0);
  }
  return value;
}

vec3 noise_mod289_3d(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }

vec4 noise_mod289_3d(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }

vec4 noise_permute_3d(vec4 x) { return noise_mod289_3d(((x * 34.0) + 1.0) * x); }

vec4 noise_taylorInvSqrt_3d(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float noise_simplex3d(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = noise_mod289_3d(i);
  vec4 p = noise_permute_3d(noise_permute_3d(noise_permute_3d(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = noise_taylorInvSqrt_3d(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float noise_simplex3d_fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 10; i++) {
    if (float(i) >= float(unode_noiseNoiseOctaves)) break;
    value += amplitude * noise_simplex3d(p * frequency);
    frequency *= clamp((unode_noiseNoiseLacunarity), 1.0, 4.0);
    amplitude *= clamp((unode_noiseNoiseGain), 0.1, 1.0);
  }
  return value;
}

float noise_hash11(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise_vnoise(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = noise_hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = noise_hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = noise_hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = noise_hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = noise_hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = noise_hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = noise_hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = noise_hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0 = mix(x00, x10, w.y);
  float y1 = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float noise_value_fbm(vec2 uv, float t, float scale, int octaves, float lacunarity, float gain) {
  vec3 p = vec3(uv * scale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 0.0;
  for (int i = 0; i < 10; ++i) {
    if (i >= octaves) break;
    sum += amp * noise_vnoise(p * freq);
    freq *= lacunarity;
    amp *= gain;
  }
  return sum * 0.5 + 0.5;
}

vec3 cr_oklch_to_rgb(vec3 oklch) {
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

float cr_interpolate_hue(float startH, float endH, float u) {
  float adjustedEndH = (endH < startH) ? endH + 360.0 : endH;
  float h = mix(startH, adjustedEndH, u);
  h = mod(h, 360.0);
  if (h < 0.0) h += 360.0;
  return h;
}

vec3 cr_sample_three_stop_oklch(
  vec3 ok0, float t0,
  vec3 ok1, float t1,
  vec3 ok2, float t2,
  float t
) {
  t = clamp(t, 0.0, 1.0);
  if (t <= t0) return cr_oklch_to_rgb(ok0);
  if (t >= t2) return cr_oklch_to_rgb(ok2);
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
  float h = cr_interpolate_hue(a.z, b.z, u);
  return cr_oklch_to_rgb(vec3(l, c, h));
}

float cg_gradientRadial(vec2 p, vec2 center, float radius, float falloff) {
  float d = length(p - center);
  float edge0 = max(0.0, radius - falloff);
  float edge1 = radius;
  return 1.0 - smoothstep(edge0, edge1, d);
}

float cg_gradientLinear(vec2 p, float angleDeg, float scale) {
  float angleRad = angleDeg * 0.017453292519943295;
  vec2 dir = vec2(cos(angleRad), sin(angleRad));
  float t = dot(p, dir) * scale + 0.5;
  return clamp(t, 0.0, 1.0);
}

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = (uv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
  
    // Node: UV Coords (node-uv)
  {

      // Output normalized screen space coordinates (p from base shader template)
      node_node_uv_out = p;
    
  }

  // Node: Noise (node-noise)
  {

    float noiseTime = (uTime + clamp((unode_noiseNoiseTimeOffset), -100.0, 100.0)) * clamp((unode_noiseNoiseTimeSpeed), 0.0, 5.0);
    float result;

    if (unode_noiseNoiseMode == 0) {
      // Simplex 2D
      float value = noise_simplex2d_fbm(node_node_uv_out * clamp((unode_noiseNoiseScale), 0.1, 20.0), noiseTime);
      result = value * clamp((unode_noiseNoiseIntensity), 0.0, 2.0);
    } else if (unode_noiseNoiseMode == 1) {
      // Simplex 3D
      float z = noiseTime * clamp((unode_noiseNoiseScale), 0.1, 20.0);
      vec3 p = vec3(node_node_uv_out.x * clamp((unode_noiseNoiseScale), 0.1, 20.0), node_node_uv_out.y * clamp((unode_noiseNoiseScale), 0.1, 20.0), z);
      float value = noise_simplex3d_fbm(p);
      float mapped = clamp(value * 0.5 + 0.5, 0.0, 1.0);
      result = mapped * clamp((unode_noiseNoiseIntensity), 0.0, 2.0);
    } else {
      // Value fBm
      float aspectRatio = uResolution.x / uResolution.y;
      vec2 uv = (node_node_uv_out - 0.5) * vec2(aspectRatio, 1.0);
      int octaves = int(unode_noiseNoiseOctaves);
      float value = noise_value_fbm(uv, noiseTime, clamp((unode_noiseNoiseScale), 0.1, 20.0), octaves, clamp((unode_noiseNoiseLacunarity), 1.0, 4.0), clamp((unode_noiseNoiseGain), 0.1, 1.0));
      result = value * clamp((unode_noiseNoiseIntensity), 0.0, 2.0);
    }

    node_node_noise_out += result;

  }

  // Node: Color Gradient (node-gradient)
  {

      vec2 p = node_node_uv_out - vec2(clamp((unode_gradientCenterX), -2.0, 2.0), clamp((unode_gradientCenterY), -2.0, 2.0));
      float tSpatial = 0.0;
      if (unode_gradientGradientMode == 0) {
        tSpatial = cg_gradientRadial(p, vec2(0.0), clamp((unode_gradientRadius), 0.01, 2.0), clamp((unode_gradientFalloff), 0.0, 5.0));
      } else {
        tSpatial = cg_gradientLinear(p, clamp((unode_gradientAngle), -180.0, 180.0), clamp((unode_gradientLinearScale), 0.1, 5.0));
      }
      tSpatial = clamp(tSpatial, 0.0, 1.0);

      float t0 = clamp(clamp((unode_gradientStop0T), 0.0, 1.0), 0.0, 1.0);
      float t1 = clamp(clamp((unode_gradientStop1T), 0.0, 1.0), t0, 1.0);
      float t2 = clamp(max(clamp((unode_gradientStop2T), 0.0, 1.0), t1), t0, 1.0);
      vec3 ok0 = vec3(clamp((unode_gradientStop0L), 0.0, 1.0), clamp((unode_gradientStop0C), 0.0, 0.4), clamp((unode_gradientStop0H), 0.0, 360.0));
      vec3 ok1 = vec3(clamp((unode_gradientStop1L), 0.0, 1.0), clamp((unode_gradientStop1C), 0.0, 0.4), clamp((unode_gradientStop1H), 0.0, 360.0));
      vec3 ok2 = vec3(clamp((unode_gradientStop2L), 0.0, 1.0), clamp((unode_gradientStop2C), 0.0, 0.4), clamp((unode_gradientStop2H), 0.0, 360.0));
      vec3 gradRgb = cr_sample_three_stop_oklch(ok0, t0, ok1, t1, ok2, t2, tSpatial);

      float v = clamp(node_node_noise_out, 0.0, 1.0);
      v = pow(v * clamp((unode_gradientValueGain), 0.0, 4.0), clamp((unode_gradientValuePower), 0.2, 4.0));
      float edge = max(clamp((unode_gradientValueSoftness), 0.0, 0.5), 0.0001);
      v = smoothstep(0.0, edge, v);
      node_node_gradient_out = gradRgb * v * clamp((unode_gradientIntensity), 0.0, 2.0);
    
  }

  
  fragColor = vec4(node_node_gradient_out, 1.0);
}