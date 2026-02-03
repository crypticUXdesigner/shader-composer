import type { NodeSpec } from '../../types';

export const directionalDisplaceNodeSpec: NodeSpec = {
  id: 'directional-displace',
  category: 'Distort',
  displayName: 'Directional Displace',
  icon: 'arrow-right',
  description: 'Displace coordinates along a fixed direction by a scalar amount',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    },
    {
      name: 'amount',
      type: 'float',
      label: 'Amount',
      fallbackParameter: 'amount'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
    }
  ],
  parameters: {
    directionalDisplaceAngle: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Angle'
    },
    directionalDisplaceScale: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Scale'
    },
    amount: { type: 'float', default: 1.0, min: -10.0, max: 10.0, step: 0.01, label: 'Amount' }
  },
  mainCode: `
  vec2 dir = vec2(cos($param.directionalDisplaceAngle), sin($param.directionalDisplaceAngle));
  $output.out = $input.in + dir * ($input.amount * $param.directionalDisplaceScale);
`
};
