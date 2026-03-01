import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Warp Terrain node — IQ-style domain-warped 2D value noise FBM with finite-diff normals and shading.
 * Replicates the visual of Inigo Quilez's "Warp" tutorial (Shadertoy ltfXzj).
 */
export const warpTerrainNodeSpec: NodeSpec = {
  id: 'warp-terrain',
  category: 'Patterns',
  displayName: 'Warp Terrain',
  description:
    'Domain-warped terrain/cloud pattern from 2D value noise FBM with rotation, finite-difference normals and shading. Based on IQ Warp tutorial.',
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
      type: 'vec4',
      label: 'Value'
    }
  ],
  parameters: {
    warpTerrainScale: {
      type: 'float',
      default: 0.7,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Scale'
    },
    warpTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.01,
      label: 'Time Speed'
    },
    warpVignetteStrength: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Vignette'
    }
  },
  parameterGroups: [
    {
      id: 'warp-main',
      label: 'Terrain',
      parameters: ['warpTerrainScale', 'warpTimeSpeed'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'warp-vignette',
      label: 'Vignette',
      parameters: ['warpVignetteStrength'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['warpTerrainScale', 'warpTimeSpeed', 'warpVignetteStrength'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
const mat2 warp_m = mat2(0.80, 0.60, -0.60, 0.80);

float warp_hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return -1.0 + 2.0 * fract(sin(h) * 43758.5453123);
}

float warp_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(warp_hash(i + vec2(0.0, 0.0)), warp_hash(i + vec2(1.0, 0.0)), u.x),
    mix(warp_hash(i + vec2(0.0, 1.0)), warp_hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float warp_fbm(vec2 p) {
  float f = 0.0;
  f += 0.5000 * warp_noise(p);  p = warp_m * p * 2.02;
  f += 0.2500 * warp_noise(p);  p = warp_m * p * 2.03;
  f += 0.1250 * warp_noise(p);  p = warp_m * p * 2.01;
  f += 0.0625 * warp_noise(p);
  return f / 0.9375;
}

vec2 warp_fbm2(vec2 p) {
  return vec2(warp_fbm(p), warp_fbm(p.yx));
}

vec3 warp_map(vec2 p, float time) {
  p *= $param.warpTerrainScale;
  float tScale = $param.warpTimeSpeed * 0.05;
  vec2 q = 1.0 * (tScale * time + p + warp_fbm2(-tScale * time + 2.0 * (p + warp_fbm2(4.0 * p))));
  float f = dot(warp_fbm2(q), vec2(1.0, -1.0));
  float bl = smoothstep(-0.8, 0.8, f);
  float ti = smoothstep(-1.0, 1.0, warp_fbm(p));
  return mix(
    mix(vec3(0.50, 0.00, 0.00), vec3(1.00, 0.75, 0.35), ti),
    vec3(0.00, 0.00, 0.02),
    bl
  );
}
`,
  mainCode: `
  vec2 res = $resolution;
  vec2 uv = $input.in;
  float aspect = res.x / res.y;
  vec2 p = (uv - 0.5) * vec2(aspect * 2.0, 2.0);

  float e = 0.0045;

  vec3 colc = warp_map(p, $time);
  vec3 cola = warp_map(p + vec2(e, 0.0), $time);
  vec3 colb = warp_map(p + vec2(0.0, e), $time);

  float gc = dot(colc, vec3(0.333));
  float ga = dot(cola, vec3(0.333));
  float gb = dot(colb, vec3(0.333));

  vec3 nor = normalize(vec3(ga - gc, e, gb - gc));

  vec3 col = colc;
  col += vec3(1.0, 0.7, 0.6) * 8.0 * abs(2.0 * gc - ga - gb);
  col *= 1.0 + 0.2 * nor.y * nor.y;
  col += 0.05 * nor.y * nor.y * nor.y;

  vec2 q = uv;
  float vig = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), $param.warpVignetteStrength);
  col *= vig;

  $output.out = vec4(col, 1.0);
`
};
