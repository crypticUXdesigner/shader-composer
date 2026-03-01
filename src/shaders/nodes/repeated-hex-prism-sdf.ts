import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Repeated Hex Prism SDF
 * 3D SDF: infinite grid of hex prisms via opRep(p, spacing) then sdHexPrism(q, h).
 * vec3 position in → float SDF out. Connect to generic raymarcher for Shadertoy-style repeated hex scene.
 * Reference: Shadertoy hex-prism raymarch (ltfXzj-style).
 */
export const repeatedHexPrismSdfNodeSpec: NodeSpec = {
  id: 'repeated-hex-prism-sdf',
  category: 'SDF',
  displayName: 'Repeated 3D Hex',
  description:
    '3D SDF for an infinite grid of hex prisms. Domain repetition: mod(p, spacing) - 0.5*spacing then hex prism SDF. Connect a vec3 position (e.g. from raymarcher); output is a float SDF. Parameters: spacing (X,Y,Z), hex radius, half-height.',
  icon: 'hexagon',
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
    spacingX: {
      type: 'float',
      default: 2.5,
      min: 0.1,
      max: 20.0,
      step: 0.1,
      label: 'Spacing X',
      supportsAnimation: true,
      supportsAudio: true
    },
    spacingY: {
      type: 'float',
      default: 2.5,
      min: 0.1,
      max: 20.0,
      step: 0.1,
      label: 'Spacing Y',
      supportsAnimation: true,
      supportsAudio: true
    },
    spacingZ: {
      type: 'float',
      default: 2.5,
      min: 0.1,
      max: 20.0,
      step: 0.1,
      label: 'Spacing Z',
      supportsAnimation: true,
      supportsAudio: true
    },
    hexRadius: {
      type: 'float',
      default: 0.3,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Hex radius',
      supportsAnimation: true,
      supportsAudio: true
    },
    halfHeight: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 5.0,
      step: 0.01,
      label: 'Half height',
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
      id: 'repetitionAndShape',
      label: 'Spacing & shape',
      parameters: ['spacingX', 'spacingY', 'spacingZ', 'hexRadius', 'halfHeight'],
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
        label: 'Spacing & shape',
        parameters: ['spacingX', 'spacingY', 'spacingZ', 'hexRadius', 'halfHeight'],
        layout: { columns: 3, parameterSpan: { halfHeight: 2 } }
      },
      {
        type: 'grid',
        label: 'Position',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  mainCode: `
  vec3 spacing = vec3($param.spacingX, $param.spacingY, $param.spacingZ);
  vec3 q = mod($input.position, spacing) - 0.5 * spacing;
  vec3 q2 = abs(q);
  float d = max(q2.z - $param.halfHeight, max((q2.x * 0.866025 + q2.y * 0.5), q2.y) - $param.hexRadius);
  $output.out = d;
`
};
