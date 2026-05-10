import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Warp Terrain — IQ-style domain-warped 2D value noise FBM with neutral grayscale
 * shading, finite-difference bump lighting and adjustable ridge/specular cues.
 */
export const warpTerrainNodeSpec: NodeSpec = {
  id: 'warp-terrain',
  category: 'Patterns',
  displayName: 'Warp Terrain',
  description:
    'Domain-warped value-noise terrain field with shaded neutral grayscale output. Adjust ridge and diffuse bump separately; vignette removed—add in the graph.',
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
      label: 'Color'
    }
  ],
  parameters: {
    warpTerrainScale: {
      type: 'float',
      default: 0.7,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Terrain Scale'
    },
    warpTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.001,
      label: 'Time Speed'
    },
    warpTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.001,
      label: 'Time Offset',
      knobPolarity: 'two-sided'
    },
    warpTerrainRidge: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.01,
      label: 'Ridge Highlights'
    },
    warpTerrainBump: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.01,
      label: 'Bump / Diffuse'
    }
  },
  parameterGroups: [
    {
      id: 'warp-main',
      label: 'Field',
      parameters: ['warpTerrainScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'warp-animation',
      label: 'Animation',
      parameters: ['warpTimeSpeed', 'warpTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'warp-shade',
      label: 'Shading',
      parameters: ['warpTerrainRidge', 'warpTerrainBump'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    minColumns: 2,
    elements: [
      {
        type: 'grid',
        label: 'Field',
        parameters: ['warpTerrainScale'],
        layout: { columns: 2, parameterSpan: { warpTerrainScale: 2 } }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['warpTimeSpeed', 'warpTimeOffset'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Shading',
        parameters: ['warpTerrainRidge', 'warpTerrainBump'],
        layout: { columns: 2 }
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

void warp_ter_fields(vec2 p, float time, out float o_ti, out float o_bl) {
  p *= $param.warpTerrainScale;
  float tScale = $param.warpTimeSpeed * 0.05;
  vec2 q = tScale * time + p + warp_fbm2(-tScale * time + 2.0 * (p + warp_fbm2(4.0 * p)));
  float f_q = dot(warp_fbm2(q), vec2(1.0, -1.0));
  o_bl = smoothstep(-0.8, 0.8, f_q);
  o_ti = smoothstep(-1.0, 1.0, warp_fbm(p));
}

float warp_ter_neutral_gray(float ti, float bl) {
  return mix(mix(0.18, 0.92, ti), 0.06, bl);
}
`,
  mainCode: `
  vec2 res = $resolution;
  vec2 uv = $input.in;
  float aspect = res.x / res.y;
  vec2 p = (uv - 0.5) * vec2(aspect * 2.0, 2.0);

  float warpTime = $time + $param.warpTimeOffset;
  float ti;
  float bl;
  warp_ter_fields(p, warpTime, ti, bl);

  float e = 0.0045;
  float tia, bla;
  float tib, blb;
  warp_ter_fields(p + vec2(e, 0.0), warpTime, tia, bla);
  warp_ter_fields(p + vec2(0.0, e), warpTime, tib, blb);

  vec3 colc = vec3(warp_ter_neutral_gray(ti, bl));
  vec3 cola = vec3(warp_ter_neutral_gray(tia, bla));
  vec3 colb = vec3(warp_ter_neutral_gray(tib, blb));

  float gc = dot(colc, vec3(0.333));
  float ga = dot(cola, vec3(0.333));
  float gb = dot(colb, vec3(0.333));

  vec3 nor = normalize(vec3(ga - gc, e, gb - gc));

  vec3 ridgeRgb = vec3(1.0);
  float ridgeAmt = max($param.warpTerrainRidge, 0.0);
  vec3 accented = colc + ridgeRgb * ridgeAmt * 8.0 * abs(2.0 * gc - ga - gb);

  float bump = max($param.warpTerrainBump, 0.0);
  vec3 col = accented * (1.0 + bump * 0.2 * nor.y * nor.y) + vec3(bump * 0.05 * nor.y * nor.y * nor.y);

  $output.out = vec4(col, 1.0);
`
};
