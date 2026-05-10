import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Radial Repeat SDF
 * 3D SDF primitive: concentric spherical shells.
 * Distance = abs(mod(length(p), shellSpacing) - ringPhase * shellSpacing).
 * vec3 position in → float SDF out. Usable standalone or as input to generic raymarcher.
 */
export const radialRepeatSdfNodeSpec: NodeSpec = {
  id: 'radial-repeat-sdf',
  category: 'SDF',
  displayName: 'Radial Repeat SDF',
  description:
    '3D SDF: concentric spherical shells (radial repeat along radius). Shell spacing sets distance between repeats along radius; ring phase is 0–1 inside each spacing (half offset = phase × spacing). When wired into SDF Raymarch sdf, march position is injected each step—use Position input for overrides or use outside raymarching. Outputs float distance for SDF composition.',
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
    shellSpacing: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 10.0,
      step: 0.01,
      label: 'Shell spacing',
      supportsAnimation: true,
      supportsAudio: true
    },
    ringPhase: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Ring phase',
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
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    positionY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    positionZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' }
  },
  parameterGroups: [
    {
      id: 'repeat',
      label: 'Repeat',
      parameters: ['shellSpacing', 'ringPhase'],
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
        parameters: ['shellSpacing', 'ringPhase'],
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
float radialRepeatSdf(vec3 p, float shellSpacing, float halfOffset) {
  float r = length(p);
  return abs(mod(r, shellSpacing) - halfOffset);
}
`,
  mainCode: `
  $output.out = radialRepeatSdf($input.position, $param.shellSpacing, $param.ringPhase * $param.shellSpacing);
`
};
