import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Julia / Mandelbrot slab SDF
 * 2D quadratic Julia escape-time distance estimate on **p.xy**, intersected with a thin slab
 * around **z = 0** via `max(slab, d_exterior)`. Cheaper than 3D bulbs; not Mandelbulb topology.
 * Exterior distance (first escape): `0.5 * log(|z|) * |z| / |dz/dz0|` with `log(max(|z|, ε))`
 * and `|dz|` clamped to avoid division blow-ups.
 */
export const juliaSlabSdfNodeSpec: NodeSpec = {
  id: 'julia-slab-sdf',
  category: 'SDF',
  displayName: 'Julia slab SDF',
  description:
    'Low-cost **2D Julia (or Mandelbrot-style) escape field** mapped to a **thin 3D slab** around z = 0: iterates z ← z² + c on scaled **XY**, uses an exterior **distance estimate** when |z| passes the escape radius, then combines with **|z₃| − halfThickness** via `max` (slab ∩ exterior field). This is **not** a Mandelbulb or full 3D escape-time surface. Defaults keep iteration count modest for smooth previews when c or scale is automated or audio-driven.',
  icon: 'sparkles-2',
  inputs: [
    {
      name: 'position',
      type: 'vec3',
      label: 'Position',
      fallbackParameter: 'positionX,positionY,positionZ'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Distance'
    }
  ],
  parameters: {
    juliaReal: {
      type: 'float',
      default: -0.8,
      min: -2.0,
      max: 2.0,
      step: 0.001,
      label: 'Julia c.x',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    juliaImag: {
      type: 'float',
      default: 0.156,
      min: -2.0,
      max: 2.0,
      step: 0.001,
      label: 'Julia c.y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    slabHalfThickness: {
      type: 'float',
      default: 0.04,
      min: 0.001,
      max: 1.0,
      step: 0.001,
      label: 'Slab half-thickness',
      supportsAnimation: true,
      supportsAudio: true
    },
    xyScale: {
      type: 'float',
      default: 1.75,
      min: 0.25,
      max: 12.0,
      step: 0.01,
      label: 'XY scale',
      supportsAnimation: true,
      supportsAudio: true
    },
    escapeRadius: {
      type: 'float',
      default: 4.0,
      min: 2.01,
      max: 32.0,
      step: 0.01,
      label: 'Escape radius',
      supportsAnimation: true,
      supportsAudio: true
    },
    maxIter: {
      type: 'int',
      default: 24,
      min: 4,
      max: 64,
      step: 1,
      label: 'Max iterations',
      supportsAnimation: false,
      supportsAudio: false
    },
    positionX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.01,
      label: 'Pos X',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    positionY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.01,
      label: 'Pos Y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    positionZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.01,
      label: 'Pos Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'julia',
      label: 'Julia',
      parameters: ['juliaReal', 'juliaImag', 'xyScale', 'escapeRadius', 'maxIter'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'slab',
      label: 'Slab',
      parameters: ['slabHalfThickness'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'position',
      label: 'Position (when unconnected)',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['juliaReal', 'juliaImag', 'xyScale'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        parameters: ['escapeRadius', 'maxIter', 'slabHalfThickness'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Position',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
vec2 juliaSlabCmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Exterior distance estimate on first escape; small negative proxy if still bounded after maxIter.
float juliaSlabFractalDe(vec2 z0, vec2 c, float escapeR, int maxIter) {
  vec2 z = z0;
  vec2 dz = vec2(1.0, 0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= maxIter) break;
    dz = 2.0 * juliaSlabCmul(z, dz);
    z = juliaSlabCmul(z, z) + c;
    float r2 = dot(z, z);
    float r2lim = escapeR * escapeR;
    if (r2 > r2lim) {
      float r = sqrt(r2);
      float lz = log(max(r, 1e-6));
      float ddz = length(dz);
      return 0.5 * lz * r / max(ddz, 1e-8);
    }
  }
  return -0.05;
}

float juliaSlabSdf(vec3 p, vec2 c, float xyScale, float escapeR, int maxIter, float slabHalf) {
  vec2 z0 = p.xy * xyScale;
  float slab = abs(p.z) - slabHalf;
  float jde = juliaSlabFractalDe(z0, c, escapeR, maxIter);
  return max(slab, jde);
}
`,
  mainCode: `
  vec3 juliaSlabP = $input.position - vec3($param.positionX, $param.positionY, $param.positionZ);
  vec2 juliaSlabC = vec2($param.juliaReal, $param.juliaImag);
  $output.out = juliaSlabSdf(juliaSlabP, juliaSlabC, $param.xyScale, $param.escapeRadius, $param.maxIter, $param.slabHalfThickness);
`
};
