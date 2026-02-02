import type { NodeSpec } from '../../types';

export const brickTilingNodeSpec: NodeSpec = {
  id: 'brick-tiling',
  category: 'Distort',
  displayName: 'Brick Tiling',
  icon: 'grid',
  description: 'Tiled coordinates with row/column offset for brick and staggered patterns',
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
    brickScaleX: {
      type: 'float',
      default: 4.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Scale X'
    },
    brickScaleY: {
      type: 'float',
      default: 4.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Scale Y'
    },
    brickOffsetX: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Row Offset X'
    },
    brickOffsetY: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Offset Y'
    }
  },
  parameterGroups: [
    {
      id: 'brick-main',
      label: 'Brick Tiling',
      parameters: ['brickScaleX', 'brickScaleY', 'brickOffsetX', 'brickOffsetY'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
vec2 brickTiling(vec2 p, vec2 scale, float rowOffsetX, float offsetY) {
  vec2 scaled = p * scale;
  float row = floor(scaled.y);
  float off = fract(row + 0.001) * rowOffsetX;
  vec2 uv = vec2(scaled.x + off, scaled.y);
  return fract(uv) + vec2(0.0, offsetY);
}
`,
  mainCode: `
  vec2 brickScale = vec2($param.brickScaleX, $param.brickScaleY);
  $output.out = brickTiling($input.in, brickScale, $param.brickOffsetX, $param.brickOffsetY);
`
};
