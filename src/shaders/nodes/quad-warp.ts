import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Bilinear warp in aspect-corrected screen space (same `p` as UV Coords / base shader).
 * Corners are positions on the unit square [0,1]² (identity = BL/BR/TL/TR at 0,0 / 1,0 / 0,1 / 1,1).
 * Corner order: bottom-left, bottom-right, top-left, top-right.
 */
export const quadWarpNodeSpec: NodeSpec = {
  id: 'quad-warp',
  category: 'Distort',
  displayName: 'Quad Warp',
  icon: 'perspective',
  description: 'Perspective warp in screen space; corners on the unit square, identity at defaults',
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
      label: 'Bottom Left X',
      knobPolarity: 'two-sided' },
    quadCorner0Y: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Left Y',
      knobPolarity: 'two-sided' },
    quadCorner1X: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Right X',
      knobPolarity: 'two-sided' },
    quadCorner1Y: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Bottom Right Y',
      knobPolarity: 'two-sided' },
    quadCorner2X: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Left X',
      knobPolarity: 'two-sided' },
    quadCorner2Y: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Left Y',
      knobPolarity: 'two-sided' },
    quadCorner3X: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Right X',
      knobPolarity: 'two-sided' },
    quadCorner3Y: {
      type: 'float',
      default: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Top Right Y',
      knobPolarity: 'two-sided' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'quadCorner2X', 'quadCorner2Y',
          'quadCorner3X', 'quadCorner3Y',
          'quadCorner0X', 'quadCorner0Y',
          'quadCorner1X', 'quadCorner1Y'
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
        layout: {
          columns: 4,
          coordsSpan: 2,
          coordsOrigin: 'bottom-left',
          coordsDisplacementAnchor: {
            quadCorner0X: { x: 0.0, y: 0.0 },
            quadCorner1X: { x: 1.0, y: 0.0 },
            quadCorner2X: { x: 0.0, y: 1.0 },
            quadCorner3X: { x: 1.0, y: 1.0 }
          }
        }
      }
    ]
  },
  functions: `
vec2 quadWarpScreenToUnit(vec2 p, float aspect) {
  return vec2(p.x / aspect + 1.0, p.y + 1.0) * 0.5;
}

vec2 quadWarpUnitToScreen(vec2 uv, float aspect) {
  return (uv * 2.0 - 1.0) * vec2(aspect, 1.0);
}

vec2 quadWarpBilinear(vec2 uv, vec2 c00, vec2 c10, vec2 c01, vec2 c11) {
  float u = uv.x, v = uv.y;
  return (1.0 - u) * (1.0 - v) * c00 + u * (1.0 - v) * c10 + (1.0 - u) * v * c01 + u * v * c11;
}
`,
  mainCode: `
  float aspect = $resolution.x / max($resolution.y, 1.0);
  vec2 c00 = vec2($param.quadCorner0X, $param.quadCorner0Y);
  vec2 c10 = vec2($param.quadCorner1X, $param.quadCorner1Y);
  vec2 c01 = vec2($param.quadCorner2X, $param.quadCorner2Y);
  vec2 c11 = vec2($param.quadCorner3X, $param.quadCorner3Y);
  vec2 uvIn = quadWarpScreenToUnit($input.in, aspect);
  vec2 uvOut = quadWarpBilinear(uvIn, c00, c10, c01, c11);
  $output.out = quadWarpUnitToScreen(uvOut, aspect);
`
};
