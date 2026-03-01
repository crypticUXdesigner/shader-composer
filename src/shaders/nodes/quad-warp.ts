import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Maps input (u,v) from unit square to a quadrilateral defined by 4 corners.
 * Corner order: bottom-left (0,0), bottom-right (1,0), top-left (0,1), top-right (1,1).
 */
export const quadWarpNodeSpec: NodeSpec = {
  id: 'quad-warp',
  category: 'Distort',
  displayName: 'Quad Warp',
  icon: 'perspective',
  description: 'Map unit square to a quadrilateral (4 corners) for perspective and screen effects',
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
    quadCorner0X: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Left X'
    },
    quadCorner0Y: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Left Y'
    },
    quadCorner1X: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Right X'
    },
    quadCorner1Y: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Right Y'
    },
    quadCorner2X: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Left X'
    },
    quadCorner2Y: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Left Y'
    },
    quadCorner3X: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Right X'
    },
    quadCorner3Y: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Right Y'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'quadCorner0X', 'quadCorner0Y',
          'quadCorner1X', 'quadCorner1Y',
          'quadCorner2X', 'quadCorner2Y',
          'quadCorner3X', 'quadCorner3Y'
        ],
        parameterUI: {
          quadCorner0X: 'coords',
          quadCorner0Y: 'coords',
          quadCorner1X: 'coords',
          quadCorner1Y: 'coords',
          quadCorner2X: 'coords',
          quadCorner2Y: 'coords',
          quadCorner3X: 'coords',
          quadCorner3Y: 'coords'
        },
        layout: { columns: 2, coordsSpan: 2, coordsOrigin: 'bottom-left' }
      }
    ]
  },
  functions: `
vec2 quadWarpBilinear(vec2 uv, vec2 c00, vec2 c10, vec2 c01, vec2 c11) {
  float u = uv.x, v = uv.y;
  vec2 p = (1.0 - u) * (1.0 - v) * c00 + u * (1.0 - v) * c10 + (1.0 - u) * v * c01 + u * v * c11;
  return p;
}
`,
  mainCode: `
  vec2 c00 = vec2($param.quadCorner0X, $param.quadCorner0Y);
  vec2 c10 = vec2($param.quadCorner1X, $param.quadCorner1Y);
  vec2 c01 = vec2($param.quadCorner2X, $param.quadCorner2Y);
  vec2 c11 = vec2($param.quadCorner3X, $param.quadCorner3Y);
  $output.out = quadWarpBilinear($input.in, c00, c10, c01, c11);
`
};
