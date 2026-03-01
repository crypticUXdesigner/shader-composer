import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Iterated Inversion node — orbit center, circle inversion with angle twist,
 * and gaussian-blob accumulation. Based on the "Inversion 2" effect by Inigo Quilez
 * (Shadertoy 4t3SzN); reimplemented with parameterized controls.
 */
export const iteratedInversionNodeSpec: NodeSpec = {
  id: 'iterated-inversion',
  category: 'Patterns',
  displayName: 'Iter. Invert',
  description:
    'Orbiting circle inversions with twist and gaussian blob accumulation, producing organic flowing blobs',
  icon: 'circle-dashed',
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
      type: 'vec3',
      label: 'Color'
    }
  ],
  parameters: {
    iteratedInversionIterations: {
      type: 'int',
      default: 32,
      min: 1,
      max: 64,
      step: 1,
      label: 'Iterations'
    },
    iteratedInversionTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    iteratedInversionTwist: {
      type: 'float',
      default: 0.6,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Twist'
    },
    iteratedInversionOrbitRadius: {
      type: 'float',
      default: 0.35,
      min: 0.05,
      max: 0.9,
      step: 0.01,
      label: 'Orbit Radius'
    },
    iteratedInversionScale: {
      type: 'float',
      default: 1.0,
      min: 0.3,
      max: 3.0,
      step: 0.01,
      label: 'Scale'
    },
    iteratedInversionBlobStrength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Blob Strength'
    },
    iteratedInversionBlobSharpness: {
      type: 'float',
      default: 10.0,
      min: 0.5,
      max: 30.0,
      step: 0.1,
      label: 'Blob Sharpness'
    },
    iteratedInversionHueOffset: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Hue Offset'
    },
    iteratedInversionHueSpread: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.1,
      step: 0.002,
      label: 'Hue Spread'
    },
    iteratedInversionHueAngle: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Hue Angle'
    },
    iteratedInversionExposure: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.05,
      label: 'Exposure'
    }
  },
  parameterGroups: [
    {
      id: 'iterated-inversion-main',
      label: 'Iterated Inversion',
      parameters: [
        'iteratedInversionIterations',
        'iteratedInversionTimeSpeed',
        'iteratedInversionTwist',
        'iteratedInversionOrbitRadius',
        'iteratedInversionScale'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'iterated-inversion-appearance',
      label: 'Appearance',
      parameters: [
        'iteratedInversionBlobStrength',
        'iteratedInversionBlobSharpness',
        'iteratedInversionExposure'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'iterated-inversion-color',
      label: 'Color',
      parameters: [
        'iteratedInversionHueOffset',
        'iteratedInversionHueSpread',
        'iteratedInversionHueAngle'
      ],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'iteratedInversionIterations',
          'iteratedInversionTimeSpeed',
          'iteratedInversionTwist',
          'iteratedInversionOrbitRadius',
          'iteratedInversionScale'
        ],
        layout: { columns: 2, parameterSpan: { iteratedInversionIterations: 2 } }
      },
      {
        type: 'grid',
        label: 'Appearance',
        parameters: [
          'iteratedInversionBlobStrength',
          'iteratedInversionBlobSharpness',
          'iteratedInversionExposure'
        ],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Color',
        parameters: [
          'iteratedInversionHueOffset',
          'iteratedInversionHueSpread',
          'iteratedInversionHueAngle'
        ],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
// HSV to RGB (h in 0..1)
vec3 hueToRgb(float h) {
  vec3 k = vec3(1.0, 2.0 / 3.0, 1.0 / 3.0);
  vec3 p = abs(fract(h + k) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

// One iteration: orbit center, circle inversion with twist, return accumulated color.
// Reference: Inigo Quilez "Inversion 2" (Shadertoy 4t3SzN); logic reimplemented with params.
vec3 iteratedInversionColor(vec2 p, float time, int maxIter, float timeSpeed, float twist, float orbitRadius, float blobStrength, float blobSharpness, float hueOffset, float hueSpread, float hueAngle) {
  vec3 col = vec3(0.0);
  float t = time * timeSpeed;
  vec2 c = orbitRadius * vec2(cos(t), sin(t));

  for (int i = 0; i < 64; i++) {
    if (i >= maxIter) break;

    vec2 z = p - c;
    float r = length(z);
    float angle = atan(z.y, z.x);
    angle += twist * r;
    float rInv = 1.0 / max(r, 0.001);
    z = rInv * vec2(cos(angle), sin(angle));
    z += c;

    float s = hueOffset + float(i) * hueSpread + angle * hueAngle;
    vec3 hue = hueToRgb(fract(s));
    float g = exp(-blobSharpness * dot(z, z));
    col -= blobStrength * g * hue;
  }

  return col;
}
`,
  mainCode: `
  float aspect = $resolution.x / $resolution.y;
  vec2 uv = ($input.in - 0.5) * vec2(aspect, 1.0);
  vec2 p = uv * clamp($param.iteratedInversionScale, 0.3, 3.0);

  float t = $time;
  int maxIter = $param.iteratedInversionIterations;
  float timeSpeed = clamp($param.iteratedInversionTimeSpeed, 0.0, 5.0);
  float twist = $param.iteratedInversionTwist;
  float orbitRadius = clamp($param.iteratedInversionOrbitRadius, 0.05, 0.9);
  float blobStrength = clamp($param.iteratedInversionBlobStrength, 0.0, 2.0);
  float blobSharpness = clamp($param.iteratedInversionBlobSharpness, 0.5, 30.0);
  float hueOffset = fract($param.iteratedInversionHueOffset);
  float hueSpread = clamp($param.iteratedInversionHueSpread, 0.0, 0.1);
  float hueAngle = clamp($param.iteratedInversionHueAngle, 0.0, 0.5);
  float exposure = clamp($param.iteratedInversionExposure, 0.2, 3.0);
  if (isnan(blobStrength) || isinf(blobStrength)) blobStrength = 0.5;
  if (isnan(blobSharpness) || isinf(blobSharpness)) blobSharpness = 10.0;

  vec3 col = iteratedInversionColor(p, t, maxIter, timeSpeed, twist, orbitRadius, blobStrength, blobSharpness, hueOffset, hueSpread, hueAngle);
  col = 0.5 + 0.5 * exposure * col;
  $output.out = clamp(col, 0.0, 1.0);
`
};
