import type { NodeSpec } from '../../types';

export const displaceNodeSpec: NodeSpec = {
  id: 'displace',
  category: 'Distort',
  displayName: 'Displace',
  icon: 'arrow-big-right',
  description: 'Offset coordinates by a vector; connect noise or gradient to create driven distortion',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    },
    {
      name: 'offset',
      type: 'vec2',
      label: 'Offset'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
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
    }
  },
  parameterGroups: [
    {
      id: 'displace-main',
      label: 'Displace',
      parameters: ['displaceScale'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  mainCode: `
  $output.out = $input.in + $input.offset * $param.displaceScale;
`
};
