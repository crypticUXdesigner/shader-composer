import type { NodeSpec } from '../../types/nodeSpec';

export const scanlinesNodeSpec: NodeSpec = {
  id: 'scanlines',
  category: 'Effects',
  displayName: 'Scanlines',
  description: 'Adds horizontal scanline overlay effect, simulating CRT monitor or digital display artifacts',
  icon: 'scanline',
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
    scanlineFrequency: {
      type: 'float',
      default: 100.0,
      min: 10.0,
      max: 500.0,
      step: 1.0,
      label: 'Frequency'
    },
    scanlineThickness: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Thickness'
    },
    scanlineOpacity: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Opacity'
    },
    scanlineTimeSpeed: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 10.0,
      step: 0.1,
      label: 'Time Speed'
    },
    scanlineTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    }
  },
  parameterGroups: [
    {
      id: 'scanline-main',
      label: 'Scanlines',
      parameters: ['scanlineFrequency', 'scanlineThickness', 'scanlineOpacity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'scanline-animation',
      label: 'Animation',
      parameters: ['scanlineTimeSpeed', 'scanlineTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['scanlineFrequency', 'scanlineThickness', 'scanlineOpacity'],
        layout: { columns: 'auto' }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['scanlineTimeSpeed', 'scanlineTimeOffset'],
        layout: { columns: 'auto', parameterSpan: { scanlineTimeOffset: 2 } }
      }
    ]
  },
  functions: `
float scanlineEffect(float value, vec2 p, float frequency, float thickness, float opacity, float time) {
  // Calculate scanline position with optional scrolling
  float scanlineY = p.y + time * 0.1;
  float scanline = sin(scanlineY * frequency * 3.14159);
  
  // Create sharp lines (not smooth sine)
  scanline = step(1.0 - thickness, scanline);
  
  // Apply opacity
  return mix(value, value * (1.0 - opacity), scanline);
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Calculate screen space coordinates
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  
  float scanlineTime = ($time + $param.scanlineTimeOffset) * $param.scanlineTimeSpeed;
  float result = scanlineEffect(value, p, $param.scanlineFrequency, $param.scanlineThickness, $param.scanlineOpacity, scanlineTime);
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
