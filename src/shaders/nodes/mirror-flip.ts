import type { NodeSpec } from '../../types/nodeSpec';

export const mirrorFlipNodeSpec: NodeSpec = {
  id: 'mirror-flip',
  category: 'Distort',
  displayName: 'Mirror / Flip',
  icon: 'flip-horizontal',
  description: 'Flip coordinates horizontally and/or vertically',
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
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {
    mirrorFlipX: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      label: 'Flip X'
    },
    mirrorFlipY: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      label: 'Flip Y'
    },
    mirrorCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    mirrorCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    }
  },
  parameterGroups: [
    {
      id: 'mirror-main',
      label: 'Mirror / Flip',
      parameters: ['mirrorFlipX', 'mirrorFlipY'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'mirror-center',
      label: 'Center',
      parameters: ['mirrorCenterX', 'mirrorCenterY'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['mirrorFlipX', 'mirrorFlipY', 'mirrorCenterX', 'mirrorCenterY'],
        parameterUI: { mirrorCenterX: 'coords', mirrorCenterY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      }
    ]
  },
  mainCode: `
  vec2 c = vec2($param.mirrorCenterX, $param.mirrorCenterY);
  vec2 p = $input.in - c;
  if ($param.mirrorFlipX > 0) p.x = -p.x;
  if ($param.mirrorFlipY > 0) p.y = -p.y;
  $output.out = c + p;
`
};
