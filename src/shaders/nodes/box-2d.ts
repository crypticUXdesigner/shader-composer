import type { NodeSpec } from '../../types';

export const box2dNodeSpec: NodeSpec = {
  id: 'box-2d',
  category: 'Shapes',
  displayName: 'Box 2D',
  icon: 'square',
  description: 'Axis-aligned 2D rectangle or rounded rectangle as SDF/mask',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float'
    }
  ],
  parameters: {
    sizeX: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Width'
    },
    sizeY: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Height'
    },
    centerX: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    centerY: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    roundness: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Roundness'
    },
    softness: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.2,
      step: 0.001,
      label: 'Softness'
    },
    intensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'box-2d-size',
      label: 'Size',
      parameters: ['sizeX', 'sizeY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'box-2d-position',
      label: 'Position',
      parameters: ['centerX', 'centerY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'box-2d-roundness',
      label: 'Roundness',
      parameters: ['roundness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'box-2d-appearance',
      label: 'Appearance',
      parameters: ['softness', 'intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// 2D rounded box SDF: p = point, b = half-extents, r = corner radius (0 = sharp)
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
`,
  mainCode: `
  vec2 center = vec2($param.centerX, $param.centerY);
  vec2 p = $input.in - center;
  vec2 halfSize = vec2($param.sizeX * 0.5, $param.sizeY * 0.5);
  float r = $param.roundness;
  float d = sdRoundBox(p, halfSize, r);
  float soft = max($param.softness, 0.0001);
  float mask = 1.0 - smoothstep(0.0, soft, d);
  $output.out += mask * $param.intensity;
`
};
