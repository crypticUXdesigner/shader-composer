import type { NodeSpec } from '../../types';

export const glowBloomNodeSpec: NodeSpec = {
  id: 'glow-bloom',
  category: 'Effects',
  displayName: 'Glow',
  description: 'Adds edge glow and bloom effects to enhance existing elements',
  icon: 'glow',
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
    glowThreshold: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Threshold'
    },
    glowIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Intensity'
    },
    glowRadius: {
      type: 'float',
      default: 5.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Radius'
    },
    glowStrength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Strength'
    }
  },
  functions: `
// Simplified glow effect (distance-based approximation)
float glowEffect(float value, float threshold, float intensity) {
  float bright = max(0.0, value - threshold);
  return bright * intensity;
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Apply glow to result
  float glow = glowEffect(value, $param.glowThreshold, $param.glowIntensity);
  float result = value + glow * $param.glowStrength;
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
