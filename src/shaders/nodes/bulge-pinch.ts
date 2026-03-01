import type { NodeSpec } from '../../types/nodeSpec';

export const bulgePinchNodeSpec: NodeSpec = {
  id: 'bulge-pinch',
  category: 'Distort',
  displayName: 'Bulge / Pinch',
  icon: 'circle-dotted',
  description: 'Radial displacement from a center; positive strength bulges outward, negative pinches inward',
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
    bulgeCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    bulgeCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    bulgeStrength: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Strength'
    },
    bulgeRadius: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 5.0,
      step: 0.01,
      label: 'Radius'
    },
    bulgeFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['bulgeCenterX', 'bulgeCenterY', 'bulgeStrength', 'bulgeRadius', 'bulgeFalloff'],
        parameterUI: { bulgeCenterX: 'coords', bulgeCenterY: 'coords' },
        layout: { columns: 2, coordsSpan: 2, parameterSpan: { bulgeStrength: 2 } }
      }
    ]
  },
  functions: `
vec2 bulgePinch(vec2 p, vec2 center, float strength, float radius, float falloff) {
  vec2 offset = p - center;
  float dist = length(offset);
  if (dist < 0.0001) return p;
  float n = dist / max(radius, 0.001);
  float f = pow(1.0 - smoothstep(0.0, 1.0, n), falloff);
  float r = dist * (1.0 + strength * f);
  return center + normalize(offset) * r;
}
`,
  mainCode: `
  vec2 bulgeCenter = vec2($param.bulgeCenterX, $param.bulgeCenterY);
  $output.out = bulgePinch($input.in, bulgeCenter, $param.bulgeStrength, $param.bulgeRadius, $param.bulgeFalloff);
`
};
