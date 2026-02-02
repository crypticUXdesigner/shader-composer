import type { NodeSpec } from '../../types';

export const superellipseNodeSpec: NodeSpec = {
  id: 'superellipse',
  category: 'Shapes',
  displayName: 'Superellipse',
  description: 'Superellipse (squircle to rectangle) with power parameter; 2=ellipse, large=rect',
  icon: 'square-rounded-corners',
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
    superCenterX: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    superCenterY: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    superRadiusX: {
      type: 'float',
      default: 0.3,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Radius X'
    },
    superRadiusY: {
      type: 'float',
      default: 0.25,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Radius Y'
    },
    superPower: {
      type: 'float',
      default: 2.5,
      min: 0.5,
      max: 20.0,
      step: 0.1,
      label: 'Power'
    },
    superSoftness: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.5,
      step: 0.005,
      label: 'Softness'
    },
    superIntensity: {
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
      id: 'super-shape',
      label: 'Shape',
      parameters: ['superRadiusX', 'superRadiusY', 'superPower'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'super-position',
      label: 'Position',
      parameters: ['superCenterX', 'superCenterY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'super-appearance',
      label: 'Appearance',
      parameters: ['superSoftness', 'superIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float superellipseMask(vec2 p, float rx, float ry, float n) {
  vec2 q = abs(p) / vec2(rx, ry);
  float k = pow(q.x, n) + pow(q.y, n);
  return k;
}
`,
  mainCode: `
  vec2 superCenter = vec2($param.superCenterX, $param.superCenterY);
  vec2 p = $input.in - superCenter;
  float k = superellipseMask(p, $param.superRadiusX, $param.superRadiusY, $param.superPower);
  float halfSoft = $param.superSoftness * 0.5;
  float mask = 1.0 - smoothstep(1.0 - halfSoft, 1.0 + halfSoft, k);
  $output.out += mask * $param.superIntensity;
`
};
