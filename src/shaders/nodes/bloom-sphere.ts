import type { NodeSpec } from '../../types/nodeSpec';

/** Golden ratio for spherical Fibonacci lattice (Keinert et al.) */
const GOLDEN_RATIO = 1.618033988749895;
const PI = 3.141592653589793;

export const bloomSphereNodeSpec: NodeSpec = {
  id: 'bloom-sphere',
  category: 'Shapes',
  displayName: 'Bloom Sphere',
  description:
    'Sphere with spherical-Fibonacci lattice spots that pulse in a wave, blue outer glow and reddish inner glow. Single composite effect (no temporal buffer).',
  icon: 'glow',
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
    sphereRadius: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.01,
      label: 'Radius',
      inputMode: 'override'
    },
    spotCount: {
      type: 'int',
      default: 128,
      min: 16,
      max: 256,
      step: 1,
      label: 'Spot count'
    },
    baseSpotAngle: {
      type: 'float',
      default: 0.25,
      min: 0.05,
      max: 0.8,
      step: 0.01,
      label: 'Spot size'
    },
    waveSpeed: {
      type: 'float',
      default: 2.0,
      min: 0.0,
      max: 8.0,
      step: 0.1,
      label: 'Wave speed',
      inputMode: 'override'
    },
    waveAmplitude: {
      type: 'float',
      default: 0.12,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Wave depth'
    },
    spotSoftness: {
      type: 'float',
      default: 0.08,
      min: 0.01,
      max: 0.3,
      step: 0.01,
      label: 'Spot soft'
    },
    outerR: {
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Outer R'
    },
    outerG: {
      type: 'float',
      default: 0.4,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Outer G'
    },
    outerB: {
      type: 'float',
      default: 0.9,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Outer B'
    },
    innerR: {
      type: 'float',
      default: 0.9,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Inner R'
    },
    innerG: {
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Inner G'
    },
    innerB: {
      type: 'float',
      default: 0.15,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Inner B'
    },
    brightness: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: 'Brightness'
    }
  },
  parameterGroups: [
    {
      id: 'sphere',
      label: 'Sphere',
      parameters: ['sphereRadius', 'brightness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'spots',
      label: 'Spots',
      parameters: ['spotCount', 'baseSpotAngle', 'waveSpeed', 'waveAmplitude', 'spotSoftness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'colors',
      label: 'Colors',
      parameters: ['outerR', 'outerG', 'outerB', 'innerR', 'innerG', 'innerB'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['sphereRadius', 'brightness'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Spots',
        parameters: ['spotCount', 'baseSpotAngle', 'waveSpeed', 'waveAmplitude', 'spotSoftness'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Outer (blue)',
        parameters: ['outerR', 'outerG', 'outerB'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Inner (red)',
        parameters: ['innerR', 'innerG', 'innerB'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// Index to sphere direction (id2sf). i in [0, n-1], n >= 2. Constants in function scope so they are included when only function bodies are extracted.
vec3 bloomSphereId2Sf(float i, float n) {
  const float BS_PI = ${PI};
  const float BS_GOLDEN = ${GOLDEN_RATIO};
  float nf = max(n, 2.0);
  float z = 1.0 - (2.0 * i + 1.0) / nf;
  z = clamp(z, -1.0, 1.0);
  float phi = 2.0 * BS_PI * mod(i / BS_GOLDEN, 1.0);
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(phi), r * sin(phi), z);
}
`,
  mainCode: `
  vec2 uv = $input.in;
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(uv * 2.0 - 1.0, -1.0));

  float R = $param.sphereRadius;
  vec3 oc = ro;
  float a = dot(rd, rd);
  float b = 2.0 * dot(oc, rd);
  float c = dot(oc, oc) - R * R;
  float disc = b * b - 4.0 * a * c;

  if (disc < 0.0) {
    $output.out = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    float t = (-b - sqrt(disc)) / (2.0 * a);
    vec3 P = ro + t * rd;
    vec3 N = P / R;
    float nDotV = dot(N, -rd);

    float nSpots = clamp(float($param.spotCount), 16.0, 256.0);
    float baseAngle = $param.baseSpotAngle;
    float waveAmp = $param.waveAmplitude;
    float waveSpeed = $param.waveSpeed;
    float soft = $param.spotSoftness;
    float T = $time * waveSpeed;

    vec3 outerColor = vec3($param.outerR, $param.outerG, $param.outerB);
    vec3 innerColor = vec3($param.innerR, $param.innerG, $param.innerB);

    vec3 acc = vec3(0.0);
    for (float i = 0.0; i < 256.0; i++) {
      if (i >= nSpots) break;
      vec3 spotDir = bloomSphereId2Sf(i, nSpots);
      float phase = i * 0.1;
      float angle = baseAngle + waveAmp * sin(T + phase);
      float cosAngle = cos(angle);
      float d = dot(N, spotDir);
      float spotMask = smoothstep(cosAngle - soft, cosAngle + soft * 0.5, d);
      float outerBlend = 1.0 - max(0.0, nDotV);
      float innerBlend = max(0.0, nDotV);
      vec3 spotColor = innerColor * innerBlend + outerColor * outerBlend;
      acc += spotMask * spotColor;
    }

    float norm = 8.0 / max(nSpots * 0.1, 1.0);
    acc = clamp(acc * norm * $param.brightness, 0.0, 1.0);
    $output.out = vec4(acc, 1.0);
  }
`
};
