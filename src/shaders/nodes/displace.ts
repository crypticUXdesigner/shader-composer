import type { NodeSpec } from '../../types/nodeSpec';

export const displaceNodeSpec: NodeSpec = {
  id: 'displace',
  category: 'Distort',
  displayName: 'Displace',
  icon: 'arrow-big-right',
  description: 'Offset coordinates by a vector; connect noise or gradient to create driven distortion',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    },
    {
      name: 'offset',
      type: 'vec2',
      label: 'Offset',
      fallbackParameter: 'offsetX,offsetY'
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
    displaceScale: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Scale'
    },
    offsetX: { type: 'float', default: 0.0, min: -10.0, max: 10.0, step: 0.01, label: 'Offset X' },
    offsetY: { type: 'float', default: 0.0, min: -10.0, max: 10.0, step: 0.01, label: 'Offset Y' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['offsetX', 'offsetY', 'displaceScale'],
        parameterUI: { offsetX: 'coords', offsetY: 'coords' },
        layout: { columns: 2, coordsSpan: 2, parameterSpan: { displaceScale: 2 } }
      }
    ]
  },
  mainCode: `
  $output.out = $input.in + $input.offset * $param.displaceScale;
`
};
