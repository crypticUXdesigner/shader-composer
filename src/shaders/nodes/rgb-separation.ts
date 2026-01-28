import type { NodeSpec } from '../../types';

export const rgbSeparationNodeSpec: NodeSpec = {
  id: 'rgb-separation',
  category: 'Effects',
  displayName: 'RGB Separation',
  description: 'Advanced RGB channel separation with independent X/Y offsets per channel for glitch effects',
  icon: 'rgb-split',
  inputs: [
    {
      name: 'in',
      type: 'vec4'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4'
    }
  ],
  parameters: {
    rgbSeparationRX: {
      type: 'float',
      default: 0.1,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'X Offset'
    },
    rgbSeparationRY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Y Offset'
    },
    rgbSeparationGX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'X Offset'
    },
    rgbSeparationGY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Y Offset'
    },
    rgbSeparationBX: {
      type: 'float',
      default: -0.1,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'X Offset'
    },
    rgbSeparationBY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Y Offset'
    },
    rgbSeparationStrength: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Strength'
    }
  },
  parameterGroups: [
    {
      id: 'rgb-separation-main',
      label: 'RGB Separation',
      parameters: ['rgbSeparationStrength'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rgb-separation-red',
      label: 'Red Channel',
      parameters: ['rgbSeparationRX', 'rgbSeparationRY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rgb-separation-green',
      label: 'Green Channel',
      parameters: ['rgbSeparationGX', 'rgbSeparationGY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rgb-separation-blue',
      label: 'Blue Channel',
      parameters: ['rgbSeparationBX', 'rgbSeparationBY'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// RGB channel separation (approximated - full effect requires texture sampling)
// This modifies the result value based on position to simulate channel separation
float rgbSeparation(float value, vec2 p, vec2 rOffset, vec2 gOffset, vec2 bOffset, float strength) {
  // Approximate channel separation by modifying value based on position
  // In a full implementation, we would sample RGB channels separately
  float r = value + dot(p, rOffset) * strength * 0.1;
  float g = value + dot(p, gOffset) * strength * 0.1;
  float b = value + dot(p, bOffset) * strength * 0.1;
  
  // Combine channels (weighted average to simulate separation)
  return (r * 0.3 + g * 0.4 + b * 0.3);
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Calculate screen space coordinates
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  
  vec2 rOffset = vec2($param.rgbSeparationRX, $param.rgbSeparationRY);
  vec2 gOffset = vec2($param.rgbSeparationGX, $param.rgbSeparationGY);
  vec2 bOffset = vec2($param.rgbSeparationBX, $param.rgbSeparationBY);
  float result = rgbSeparation(value, p, rOffset, gOffset, bOffset, $param.rgbSeparationStrength);
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
