import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Spotlight (`iterated-inversion`) — orbit center, circle inversion with angle twist,
 * and gaussian-blob accumulation. Based on the "Inversion 2" effect by Inigo Quilez
 * (Shadertoy 4t3SzN); reimplemented with parameterized controls.
 */
export const iteratedInversionNodeSpec: NodeSpec = {
  id: 'iterated-inversion',
  category: 'Patterns',
  displayName: 'Spotlight',
  description:
    'Repeated circle inversions around a drifting center: each step subtracts a soft tinted blob, stacking into organic folds. Orbit + twist move the fold; scale zooms the whole pattern; pan X/Y shifts the motif in frame.',
  icon: 'lightbulb',
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
      default: 12,
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
      step: 0.001,
      label: 'Time Speed'
    },
    iteratedInversionTwist: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Twist (space)',
      knobPolarity: 'two-sided'
    },
    iteratedInversionOrbitRadius: {
      type: 'float',
      default: 0.2,
      min: 0.05,
      max: 0.9,
      step: 0.01,
      label: 'Orbit radius'
    },
    iteratedInversionScale: {
      type: 'float',
      default: 2.0,
      min: 0.3,
      max: 3.0,
      step: 0.01,
      label: 'Scale (zoom)'
    },
    iteratedInversionPanX: {
      type: 'float',
      default: -1.3,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Pan X',
      knobPolarity: 'two-sided'
    },
    iteratedInversionPanY: {
      type: 'float',
      default: -1.3,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Pan Y',
      knobPolarity: 'two-sided'
    },
    iteratedInversionBlobStrength: {
      type: 'float',
      default: 2.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Blob Strength'
    },
    iteratedInversionBlobSharpness: {
      type: 'float',
      default: 6.5,
      min: 0.5,
      max: 30.0,
      step: 0.1,
      label: 'Blob Sharpness'
    },
    iteratedInversionHueOffset: {
      type: 'float',
      default: 0.9,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Hue Offset'
    },
    iteratedInversionHueSpread: {
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 0.1,
      step: 0.002,
      label: 'Hue Spread'
    },
    iteratedInversionHueAngle: {
      type: 'float',
      default: 0.35,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Hue swirl'
    },
    iteratedInversionExposure: {
      type: 'float',
      default: 2.0,
      min: 0.2,
      max: 3.0,
      step: 0.05,
      label: 'Exposure'
    }
  },
  parameterGroups: [
    {
      id: 'iterated-inversion-frame',
      label: 'Frame',
      parameters: [
        'iteratedInversionScale',
        'iteratedInversionPanX',
        'iteratedInversionPanY'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'iterated-inversion-fold',
      label: 'Inversion & motion',
      parameters: [
        'iteratedInversionIterations',
        'iteratedInversionOrbitRadius',
        'iteratedInversionTimeSpeed',
        'iteratedInversionTwist'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'iterated-inversion-stacks',
      label: 'Stacks & brightness',
      parameters: [
        'iteratedInversionBlobStrength',
        'iteratedInversionBlobSharpness',
        'iteratedInversionExposure'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'iterated-inversion-hue',
      label: 'Hue',
      parameters: [
        'iteratedInversionHueOffset',
        'iteratedInversionHueSpread',
        'iteratedInversionHueAngle'
      ],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Frame',
        parameters: [
          'iteratedInversionScale',
          'iteratedInversionPanX',
          'iteratedInversionPanY'
        ],
        parameterUI: {
          iteratedInversionPanX: 'coords',
          iteratedInversionPanY: 'coords'
        },
        layout: { columns: 3, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Inversion & motion',
        parameters: [
          'iteratedInversionIterations',
          'iteratedInversionOrbitRadius',
          'iteratedInversionTimeSpeed',
          'iteratedInversionTwist'
        ],
        layout: {
          columns: 3,
          parameterSpan: { iteratedInversionIterations: 3 }
        }
      },
      {
        type: 'grid',
        label: 'Stacks & brightness',
        parameters: [
          'iteratedInversionBlobStrength',
          'iteratedInversionBlobSharpness',
          'iteratedInversionExposure'
        ],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Hue',
        parameters: [
          'iteratedInversionHueOffset',
          'iteratedInversionHueSpread',
          'iteratedInversionHueAngle'
        ],
        layout: { columns: 3 }
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
// Hue uses sin(twisted angle) × π (smooth in the plane): avoids atan branch cuts → no hue cliffs.
// Reference: Inigo Quilez "Inversion 2" (Shadertoy 4t3SzN); logic reimplemented with params.
vec3 iteratedInversionColor(vec2 p, float time, int maxIter, float timeSpeed, float twist, float orbitRadius, float blobStrength, float blobSharpness, float hueOffset, float hueSpread, float hueAngle) {
  vec3 col = vec3(0.0);
  float t = time * timeSpeed;
  vec2 c = orbitRadius * vec2(cos(t), sin(t));

  for (int i = 0; i < 64; i++) {
    if (i >= maxIter) break;

    vec2 z = p - c;
    float r = length(z);
    float rInv = 1.0 / max(r, 0.001);
    float zpX = z.x * rInv;
    float zpY = z.y * rInv;
    float twistR = twist * r;
    float sinTwistR = sin(twistR);
    float cosTwistR = cos(twistR);
    // sin(atan(z) + twist*r) continuous in z away from origin (never feed discontinuous atan into hue).
    float sinAngleTwisted = zpY * cosTwistR + zpX * sinTwistR;
    float angle = atan(z.y, z.x) + twistR;
    z = rInv * vec2(cos(angle), sin(angle));
    z += c;

    float s = hueOffset + float(i) * hueSpread + hueAngle * (3.141592653589793 * sinAngleTwisted);
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
  vec2 pan = vec2(clamp($param.iteratedInversionPanX, -2.0, 2.0), clamp($param.iteratedInversionPanY, -2.0, 2.0));
  vec2 p = uv * clamp($param.iteratedInversionScale, 0.3, 3.0) - pan;

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
  if (isnan(blobStrength) || isinf(blobStrength)) blobStrength = 2.0;
  if (isnan(blobSharpness) || isinf(blobSharpness)) blobSharpness = 6.5;

  vec3 col = iteratedInversionColor(p, t, maxIter, timeSpeed, twist, orbitRadius, blobStrength, blobSharpness, hueOffset, hueSpread, hueAngle);
  col = 0.5 + 0.5 * exposure * col;
  $output.out = clamp(col, 0.0, 1.0);
`
};
