import type { NodeSpec } from '../../types';

export const mirrorFlipNodeSpec: NodeSpec = {
  id: 'mirror-flip',
  category: 'Distort',
  displayName: 'Mirror / Flip',
  icon: 'flip-horizontal',
  description: 'Flip coordinates horizontally and/or vertically',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
    }
  ],
  parameters: {
    mirrorFlipX: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
      label: 'Flip X'
    },
    mirrorFlipY: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 1.0,
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
  mainCode: `
  vec2 c = vec2($param.mirrorCenterX, $param.mirrorCenterY);
  vec2 p = $input.in - c;
  if ($param.mirrorFlipX > 0.5) p.x = -p.x;
  if ($param.mirrorFlipY > 0.5) p.y = -p.y;
  $output.out = c + p;
`
};
