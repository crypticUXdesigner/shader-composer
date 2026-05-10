import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Hex Prism SDF
 * 3D SDF primitive: extruded hexagon (hex prism).
 * sdHexPrism(p, h): h.x = hex cross-section radius, h.y = half-height along extrusion axis.
 * vec3 position in → float SDF out. Usable standalone or as input to generic raymarcher.
 * Reference: Shadertoy hex-prism raymarch (ltfXzj-style).
 */
export const hexPrismSdfNodeSpec: NodeSpec = {
  id: 'hex-prism-sdf',
  category: 'SDF',
  displayName: 'Hex Prism SDF',
  description:
    '3D hex-prism signed distance. With SDF Raymarch, connect out to sdf—the march supplies the sample point; Position can stay unwired. Otherwise wire Position, or use Pos X/Y/Z to offset. Hex radius is cross-section; half height is half extrusion length along Z.',
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
      label: 'SDF'
    }
  ],
  parameters: {
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
      id: 'shape',
      label: 'Shape',
      parameters: ['hexRadius', 'halfHeight'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'position',
      label: 'Position offset',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['hexRadius', 'halfHeight'],
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
  mainCode: `
  vec3 offset = vec3($param.positionX, $param.positionY, $param.positionZ);
  vec3 q = abs($input.position - offset);
  float d = max(q.z - $param.halfHeight, max((q.x * 0.866025 + q.y * 0.5), q.y) - $param.hexRadius);
  $output.out = d;
`
};
