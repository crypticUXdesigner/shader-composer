import type { NodeSpec } from '../../types/nodeSpec';

/** Golden ratio for spherical Fibonacci lattice (Keinert et al.); same math as spherical-fibonacci node. */
const GOLDEN_RATIO = 1.618033988749895;
const PI = 3.141592653589793;

export const bloomSphereEffectNodeSpec: NodeSpec = {
  id: 'bloom-sphere-effect',
  category: 'Shapes',
  displayName: 'Bloom Sphere',
  description:
    'Sphere with evenly distributed soft spots (spherical Fibonacci lattice), time-based radius wave, and blue outer / reddish inner glow. Replicates the Shadertoy Xljcz1 look. Uses the same lattice math as the Spherical Fibonacci node but is self-contained.',
  icon: 'sphere',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    { name: 'out', type: 'vec4', label: 'Color' }
  ],
  parameters: {
    latticeCount: {
      type: 'int',
      default: 256,
      min: 4,
      max: 4096,
      step: 1,
      label: 'Spot count'
    },
    sphereRadius: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.05,
      label: 'Radius'
    },
    waveSpeed: {
      type: 'float',
      default: 2.0,
      min: 0.0,
      max: 10.0,
      step: 0.1,
      label: 'Wave speed'
    },
    spotSharpness: {
      type: 'float',
      default: 12.0,
      min: 1.0,
      max: 40.0,
      step: 0.5,
      label: 'Spot sharpness'
    },
    outerGlowR: {
      type: 'float',
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Outer R'
    },
    outerGlowG: {
      type: 'float',
      default: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Outer G'
    },
    outerGlowB: {
      type: 'float',
      default: 0.9,
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Outer B'
    },
    innerGlowR: {
      type: 'float',
      default: 0.9,
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Inner R'
    },
    innerGlowG: {
      type: 'float',
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Inner G'
    },
    innerGlowB: {
      type: 'float',
      default: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      label: 'Inner B'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['latticeCount', 'sphereRadius', 'waveSpeed', 'spotSharpness'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Outer glow (blue)',
        parameters: ['outerGlowR', 'outerGlowG', 'outerGlowB'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Inner glow (red)',
        parameters: ['innerGlowR', 'innerGlowG', 'innerGlowB'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// Spherical Fibonacci: index -> direction (same math as spherical-fibonacci node; unique names for dedup).
// Constants in function scope so they are included when FunctionGenerator extracts only function bodies.
vec3 bloomSphereId2Sf(float i, float n) {
  const float BSE_SF_PI = ${PI};
  const float BSE_SF_GOLDEN = ${GOLDEN_RATIO};
  float nf = max(n, 2.0);
  float z = 1.0 - (2.0 * i + 1.0) / nf;
  z = clamp(z, -1.0, 1.0);
  float phi = 2.0 * BSE_SF_PI * mod(i / BSE_SF_GOLDEN, 1.0);
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(phi), r * sin(phi), z);
}

float bloomSphereSf2Id(vec3 dir, float n) {
  float nf = max(n, 2.0);
  vec3 d = length(dir) > 0.001 ? normalize(dir) : vec3(0.0, 0.0, 1.0);
  float z = clamp(d.z, -1.0, 1.0);
  float iCont = (1.0 - z) * nf * 0.5 - 0.5;
  int iCenter = int(round(iCont));
  float bestDot = -2.0;
  float bestI = 0.0;
  for (int o = -2; o <= 2; o++) {
    int k = iCenter + o;
    if (k < 0) continue;
    float ik = float(k);
    if (ik >= nf) break;
    float dotK = dot(d, bloomSphereId2Sf(ik, nf));
    if (dotK > bestDot) {
      bestDot = dotK;
      bestI = ik;
    }
  }
  return bestI;
}
`,
  mainCode: `
  vec2 uv = $input.in;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv * 2.0 - 1.0) * vec2(aspect, 1.0);

  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3(p, -1.0));

  float R = $param.sphereRadius;
  vec3 oc = ro;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - R * R;
  float disc = b * b - c;
  if (disc < 0.0) {
    $output.out = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    float t = -b - sqrt(disc);
    vec3 hit = ro + t * rd;
    vec3 N = hit / R;

    float n = max(float($param.latticeCount), 2.0);
    n = min(n, 4096.0);
    float idx = bloomSphereSf2Id(N, n);
    vec3 nearestDir = bloomSphereId2Sf(round(idx), n);
    float dotN = dot(N, nearestDir);

    float spotPhase = idx * 0.1 + $time * $param.waveSpeed;
    float wave = sin(spotPhase) * 0.5 + 0.5;
    float spotMask = smoothstep(1.0 - 1.0 / max($param.spotSharpness, 1.0), 1.0, dotN);
    spotMask *= (0.3 + 0.7 * wave);

    vec3 outerColor = vec3($param.outerGlowR, $param.outerGlowG, $param.outerGlowB);
    vec3 innerColor = vec3($param.innerGlowR, $param.innerGlowG, $param.innerGlowB);
    vec3 col = mix(outerColor, innerColor, wave);
    col = mix(outerColor * 0.2, col, spotMask);

    $output.out = vec4(col, 1.0);
  }
`
};
