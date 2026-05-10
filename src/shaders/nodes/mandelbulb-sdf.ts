import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Mandelbulb SDF (triplex / spherical iteration, distance estimation).
 * vec3 position → float signed-distance estimate for generic-raymarcher.
 * Conservative defaults for typical raymarch step budgets (~64–200 steps); raise Raymarcher steps when raising iterations.
 */
export const mandelbulbSdfNodeSpec: NodeSpec = {
  id: 'mandelbulb-sdf',
  category: 'SDF',
  displayName: 'Mandelbulb SDF',
  description:
    'Escape-time Mandelbulb-style SDF via triplex iteration and analytic distance estimation. Connect position from the generic raymarcher path at each march step. Bailout, DE fudge, and sphere blend are touchy—animate gently to limit flicker. If the surface breaks up, lower iterations or raise raymarch steps before raising power.',
  icon: 'sphere',
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
      label: 'SDF'
    }
  ],
  parameters: {
    power: {
      type: 'int',
      default: 8,
      min: 2,
      max: 24,
      step: 1,
      label: 'Power',
      supportsAnimation: false,
      supportsAudio: false
    },
    iterations: {
      type: 'int',
      default: 6,
      min: 1,
      max: 32,
      step: 1,
      label: 'Iterations',
      supportsAnimation: false,
      supportsAudio: false
    },
    bailout: {
      type: 'float',
      default: 2.0,
      min: 1.2,
      max: 8.0,
      step: 0.05,
      label: 'Bailout',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'one-sided'
    },
    deFudge: {
      type: 'float',
      default: 0.72,
      min: 0.05,
      max: 2.0,
      step: 0.01,
      label: 'DE fudge',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'one-sided'
    },
    hybridMix: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Sphere blend',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'one-sided'
    },
    positionX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Offset X',
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
      step: 0.1,
      label: 'Offset Y',
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
      step: 0.1,
      label: 'Offset Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'mandelbulb',
      label: 'Mandelbulb',
      parameters: ['power', 'iterations'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'advanced',
      label: 'Advanced DE',
      parameters: ['bailout', 'deFudge', 'hybridMix'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'position',
      label: 'Position fallback',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['power', 'iterations'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Advanced DE',
        parameters: ['bailout', 'deFudge', 'hybridMix'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Offset',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
float mandelbulbSdf(vec3 c, float power, int iterations, float bailout, float deFudge, float hybridMix) {
  vec3 z = c;
  float dr = 1.0;
  float r = 0.0;
  float bailSq = bailout * bailout;
  for (int i = 0; i < 32; i++) {
    if (i >= iterations) break;
    r = length(z);
    if (r * r > bailSq) break;
    float rSafe = max(r, 1e-6);
    float invR = 1.0 / rSafe;
    float theta = acos(clamp(z.z * invR, -1.0, 1.0));
    float phi = atan(z.y, z.x + 1e-7);
    float powUse = clamp(power, 2.0, 24.0);
    float rp = pow(rSafe, powUse - 1.0);
    dr = dr * powUse * rp + 1.0;
    float zr = min(rp * rSafe, 1e6);
    theta = theta * powUse;
    phi = phi * powUse;
    float st = sin(theta);
    z = zr * vec3(st * cos(phi), st * sin(phi), cos(theta));
    z += c;
  }
  r = length(z);
  float rFin = max(r, 1e-6);
  dr = max(dr, 1e-6);
  float m = log(rFin);
  m = clamp(m, -40.0, 40.0);
  float raw = 0.5 * m * rFin / dr;
  float dist = max(deFudge * raw, 1e-5);
  dist = clamp(dist, 1e-5, 200.0);
  float outer = length(c) - clamp(bailout * 0.72, 0.5, 6.0);
  float t = clamp(hybridMix, 0.0, 1.0);
  return mix(dist, outer, t);
}
`,
  mainCode: `
  $output.out = mandelbulbSdf($input.position, float($param.power), $param.iterations, $param.bailout, $param.deFudge, $param.hybridMix);
`
};
