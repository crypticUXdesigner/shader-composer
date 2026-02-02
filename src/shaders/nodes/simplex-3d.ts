import type { NodeSpec } from '../../types';

export const simplex3dNodeSpec: NodeSpec = {
  id: 'simplex-3d',
  category: 'Patterns',
  displayName: '3D Simplex Volume',
  description: '3D Simplex (volume) noise. Input UV + time as Z for clouds, marble, and animated volume effects.',
  icon: 'noise',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float'
    }
  ],
  parameters: {
    simplex3dScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 20.0,
      step: 0.01,
      label: 'Scale'
    },
    simplex3dOctaves: {
      type: 'int',
      default: 4,
      min: 1,
      max: 8,
      step: 1,
      label: 'Octaves'
    },
    simplex3dLacunarity: {
      type: 'float',
      default: 2.0,
      min: 1.0,
      max: 4.0,
      step: 0.01,
      label: 'Lacunarity'
    },
    simplex3dGain: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.01,
      label: 'Gain'
    },
    simplex3dTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    simplex3dTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    simplex3dIntensity: {
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
      id: 'simplex3d-noise',
      label: 'Noise',
      parameters: ['simplex3dScale', 'simplex3dOctaves', 'simplex3dLacunarity', 'simplex3dGain'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'simplex3d-animation',
      label: 'Animation',
      parameters: ['simplex3dTimeSpeed', 'simplex3dTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'simplex3d-output',
      label: 'Output',
      parameters: ['simplex3dIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
vec3 mod289_3d(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289_3d(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute_3d(vec4 x) { return mod289_3d(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt_3d(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// 3D Simplex noise (Stegu/Ashima style), output approx [-1, 1]
float simplexNoise3d(vec3 v) {
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
  i = mod289_3d(i);
  vec4 p = permute_3d(permute_3d(permute_3d(
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
  vec4 norm = taylorInvSqrt_3d(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// fBm over 3D Simplex
float simplexFbm3d(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= float($param.simplex3dOctaves)) break;
    value += amplitude * simplexNoise3d(p * frequency);
    frequency *= $param.simplex3dLacunarity;
    amplitude *= $param.simplex3dGain;
  }
  return value;
}
`,
  mainCode: `
  float z = ($time + $param.simplex3dTimeOffset) * $param.simplex3dTimeSpeed * $param.simplex3dScale;
  vec3 p = vec3($input.in.x * $param.simplex3dScale, $input.in.y * $param.simplex3dScale, z);
  float value = simplexFbm3d(p);
  float mapped = clamp(value * 0.5 + 0.5, 0.0, 1.0);
  $output.out += mapped * $param.simplex3dIntensity;
`
};
