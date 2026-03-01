import type { NodeSpec } from '../../types/nodeSpec';

export const blurNodeSpec: NodeSpec = {
  id: 'blur',
  category: 'Effects',
  displayName: 'Blur',
  description: 'Applies blur effects (Gaussian, directional, radial) for depth and motion effects',
  icon: 'blur-circle',
  inputs: [
    {
      name: 'in',
      type: 'vec4',
      label: 'Color'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4',
      label: 'Color'
    }
  ],
  parameters: {
    blurAmount: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Amount'
    },
    blurRadius: {
      type: 'float',
      default: 5.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Radius'
    },
    blurType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Type'
    },
    blurDirection: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Direction'
    },
    blurCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    blurCenterY: {
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
      id: 'blur-main',
      label: 'Blur',
      parameters: ['blurAmount', 'blurRadius', 'blurType'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'blur-directional',
      label: 'Directional',
      parameters: ['blurDirection'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'blur-radial',
      label: 'Radial',
      parameters: ['blurCenterX', 'blurCenterY'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['blurAmount', 'blurRadius', 'blurType', 'blurDirection', 'blurCenterX', 'blurCenterY'],
        parameterUI: { blurCenterX: 'coords', blurCenterY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      }
    ]
  },
  functions: `
// Simple softening effect (approximation since we can't sample neighbors easily)
float soften(float value, float amount) {
  // Simple smoothing approximation
  return value * (1.0 - amount) + 0.5 * amount;
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Apply blur (simplified - full blur requires texture sampling)
  float result = soften(value, $param.blurAmount);
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
