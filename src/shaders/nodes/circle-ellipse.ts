import type { NodeSpec } from '../../types';

export const circleEllipseNodeSpec: NodeSpec = {
  id: 'circle-ellipse',
  category: 'Shapes',
  displayName: 'Circle / Ellipse',
  description: '2D circle or ellipse as a float mask with optional soft edge',
  icon: 'circle',
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
    shapeType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Shape'
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
    radius: {
      type: 'float',
      default: 0.25,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Radius'
    },
    radiusX: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Radius X'
    },
    radiusY: {
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Radius Y'
    },
    softness: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.5,
      step: 0.005,
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
      id: 'shape',
      label: 'Shape',
      parameters: ['shapeType', 'centerX', 'centerY', 'radius', 'radiusX', 'radiusY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'appearance',
      label: 'Appearance',
      parameters: ['softness', 'intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// 2D circle SDF: distance to circle of radius r
float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

// 2D ellipse: scale p by (1/rx, 1/ry) then circle SDF with r=1
float sdEllipse(vec2 p, float rx, float ry) {
  vec2 q = p / vec2(rx, ry);
  return length(q) - 1.0;
}
`,
  mainCode: `
  vec2 center = vec2($param.centerX, $param.centerY);
  vec2 p = $input.in - center;
  float d;
  if ($param.shapeType == 0) {
    d = sdCircle(p, $param.radius);
  } else {
    d = sdEllipse(p, $param.radiusX, $param.radiusY);
  }
  float halfSoft = $param.softness * 0.5;
  float mask = 1.0 - smoothstep(-halfSoft, halfSoft, d);
  $output.out += mask * $param.intensity;
`
};
