import type { NodeSpec } from '../../types/nodeSpec';

export const scanlinesNodeSpec: NodeSpec = {
  id: 'scanlines',
  category: 'Effects',
  displayName: 'Scanlines',
  description:
    'CRT-style horizontal stripes: Frequency sets line spacing (sin scale on Y). Applies to luminance while preserving saturation; animate with Time speed/offset.',  icon: 'scanline',
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
      step: 0.001,
      label: 'Time Speed'
    },
    scanlineTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.001,
      label: 'Time Offset',
      knobPolarity: 'two-sided' }
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
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  float scanlineTime = ($time + $param.scanlineTimeOffset) * $param.scanlineTimeSpeed;
  float scanned = scanlineEffect(lum, p, $param.scanlineFrequency, $param.scanlineThickness, $param.scanlineOpacity, scanlineTime);
  vec3 resultRgb = lum > 1e-4 ? clamp(color * (scanned / lum), 0.0, 1.0) : vec3(scanned);
  $output.out = vec4(resultRgb, inColor.a);
`
};
