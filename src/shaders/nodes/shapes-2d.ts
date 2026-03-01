import type { NodeSpec } from '../../types/nodeSpec';

export const shapes2dNodeSpec: NodeSpec = {
  id: 'shapes-2d',
  category: 'Shapes',
  displayName: 'Shapes',
  icon: 'shapes-filled',
  description: 'Circle (or ellipse) and square (or rounded box) as SDF/mask. Aspect from size.',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Position'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Value'
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
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    roundness: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Roundness'
    },
    softness: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.5,
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
      id: 'shapes-2d-shape',
      label: 'Shape',
      parameters: ['shapeType', 'sizeX', 'sizeY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'shapes-2d-position',
      label: 'Position',
      parameters: ['centerX', 'centerY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'shapes-2d-roundness',
      label: 'Roundness',
      parameters: ['roundness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'shapes-2d-appearance',
      label: 'Appearance',
      parameters: ['softness', 'intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['shapeType', 'sizeX', 'sizeY', 'centerX', 'centerY', 'roundness', 'softness', 'intensity'],
        parameterUI: { sizeX: 'coords', sizeY: 'coords', centerX: 'coords', centerY: 'coords' },
        layout: {
          columns: 2,
          coordsSpan: 2,
          coordsOrigin: { sizeX: 'bottom-left', centerX: 'center' },
          parameterSpan: { shapeType: 2, roundness: 2, softness: 2, intensity: 2 }
        }
      }
    ]
  },
  functions: `
float sdEllipse(vec2 p, float rx, float ry) {
  vec2 q = p / vec2(rx, ry);
  return length(q) - 1.0;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
`,
  mainCode: `
  vec2 center = vec2($param.centerX, $param.centerY);
  vec2 p = $input.in - center;
  float d;
  if ($param.shapeType == 0) {
    float rx = $param.sizeX * 0.5;
    float ry = $param.sizeY * 0.5;
    d = sdEllipse(p, rx, ry);
  } else {
    vec2 halfSize = vec2($param.sizeX * 0.5, $param.sizeY * 0.5);
    d = sdRoundBox(p, halfSize, $param.roundness);
  }
  float mask;
  if ($param.shapeType == 0) {
    float halfSoft = $param.softness * 0.5;
    mask = 1.0 - smoothstep(-halfSoft, halfSoft, d);
  } else {
    float soft = max($param.softness, 0.0001);
    mask = 1.0 - smoothstep(0.0, soft, d);
  }
  $output.out += mask * $param.intensity;
`
};
