import type { NodeSpec } from '../../types/nodeSpec';

export const noiseNodeSpec: NodeSpec = {
  id: 'noise',
  category: 'Patterns',
  displayName: 'Noise',
  description: 'Procedural noise with Simplex 2D, Simplex 3D, or Value fBm. Shared parameters for scale, octaves, lacunarity, gain, and animation.',
  icon: 'noise',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Noise'
    }
  ],
  parameters: {
    noiseMode: {
      type: 'int',
      default: 2,
      min: 0,
      max: 2,
      step: 1,
      label: 'Mode'
    },
    noiseScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 20.0,
      step: 0.01,
      label: 'Scale'
    },
    noiseOctaves: {
      type: 'int',
      default: 4,
      min: 1,
      max: 10,
      step: 1,
      label: 'Octaves'
    },
    noiseLacunarity: {
      type: 'float',
      default: 2.0,
      min: 1.0,
      max: 4.0,
      step: 0.01,
      label: 'Lacunarity'
    },
    noiseGain: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.01,
      label: 'Gain'
    },
    noiseTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    noiseTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    noiseIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'noise-main',
      label: 'Noise',
      parameters: ['noiseMode', 'noiseScale', 'noiseOctaves', 'noiseLacunarity', 'noiseGain', 'noiseIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'noise-animation',
      label: 'Animation',
      parameters: ['noiseTimeSpeed', 'noiseTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    minColumns: 3,
    elements: [
      {
        type: 'grid',
        parameters: ['noiseMode', 'noiseScale', 'noiseOctaves', 'noiseLacunarity', 'noiseGain', 'noiseIntensity'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['noiseTimeSpeed', 'noiseTimeOffset'],
        layout: { columns: 3, parameterSpan: { noiseTimeOffset: 2 } }
      }
    ]
  },
  functions: `
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
    if (float(i) >= float($param.noiseOctaves)) break;
    float octaveTime = time * (0.5 + float(i) * 0.2);
    value += amplitude * noise_simplex2d(p * frequency + vec2(octaveTime * 0.1, octaveTime * 0.15), octaveTime);
    frequency *= $param.noiseLacunarity;
    amplitude *= $param.noiseGain;
  }
  return value;
}

// ----- Simplex 3D -----
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
    if (float(i) >= float($param.noiseOctaves)) break;
    value += amplitude * noise_simplex3d(p * frequency);
    frequency *= $param.noiseLacunarity;
    amplitude *= $param.noiseGain;
  }
  return value;
}

// ----- Value fBm -----
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
`,
  mainCode: `
  float noiseTime = ($time + $param.noiseTimeOffset) * $param.noiseTimeSpeed;
  float result;

  if ($param.noiseMode == 0) {
    // Simplex 2D
    float value = noise_simplex2d_fbm($input.in * $param.noiseScale, noiseTime);
    result = value * $param.noiseIntensity;
  } else if ($param.noiseMode == 1) {
    // Simplex 3D
    float z = noiseTime * $param.noiseScale;
    vec3 p = vec3($input.in.x * $param.noiseScale, $input.in.y * $param.noiseScale, z);
    float value = noise_simplex3d_fbm(p);
    float mapped = clamp(value * 0.5 + 0.5, 0.0, 1.0);
    result = mapped * $param.noiseIntensity;
  } else {
    // Value fBm
    float aspectRatio = $resolution.x / $resolution.y;
    vec2 uv = ($input.in - 0.5) * vec2(aspectRatio, 1.0);
    int octaves = int($param.noiseOctaves);
    float value = noise_value_fbm(uv, noiseTime, $param.noiseScale, octaves, $param.noiseLacunarity, $param.noiseGain);
    result = value * $param.noiseIntensity;
  }

  $output.out += result;
`
};
