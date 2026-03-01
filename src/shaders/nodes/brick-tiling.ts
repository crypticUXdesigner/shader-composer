import type { NodeSpec } from '../../types/nodeSpec';

export const brickTilingNodeSpec: NodeSpec = {
  id: 'brick-tiling',
  category: 'Distort',
  displayName: 'Brick Tiling',
  icon: 'grid',
  description: 'Tiled coordinates with row/column offset for brick and staggered patterns',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
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
      default: 0.0,
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
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['brickScaleX', 'brickScaleY', 'brickOffsetX', 'brickOffsetY'],
        parameterUI: { brickOffsetX: 'coords', brickOffsetY: 'coords' },
        layout: { columns: 2, coordsSpan: 2, coordsOrigin: 'bottom-left' }
      }
    ]
  },
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
