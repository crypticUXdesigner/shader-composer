import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Radial Repeat SDF
 * 3D SDF primitive: concentric spherical shells.
 * SDF(p) = abs(mod(length(p), period) - halfPeriod)
 * vec3 position in → float SDF out. Usable standalone or as input to generic raymarcher (WP03).
 */
export const radialRepeatSdfNodeSpec: NodeSpec = {
  id: 'radial-repeat-sdf',
  category: 'SDF',
  displayName: 'Radial Repeat SDF',
  description:
    '3D SDF primitive that outputs concentric spherical shells. Distance field: abs(mod(length(p), period) - halfPeriod). Connect a vec3 position (e.g. from raymarcher); output is a float SDF for use in raymarching or other SDF composition.',
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
      label: 'Distance'
    }
  ],
  parameters: {
    period: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 10.0,
      step: 0.01,
      label: 'Period',
      supportsAnimation: true,
      supportsAudio: true
    },
    halfPeriod: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 10.0,
      step: 0.01,
      label: 'Half period',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos X',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    }
  },
  parameterGroups: [
    {
      id: 'repeat',
      label: 'Repeat',
      parameters: ['period', 'halfPeriod'],
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
        parameters: ['period', 'halfPeriod'],
        layout: { columns: 2 }
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
float radialRepeatSdf(vec3 p, float period, float halfPeriod) {
  float r = length(p);
  return abs(mod(r, period) - halfPeriod);
}
`,
  mainCode: `
  $output.out = radialRepeatSdf($input.position, $param.period, $param.halfPeriod);
`
};
