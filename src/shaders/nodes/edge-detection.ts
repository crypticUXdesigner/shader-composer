import type { NodeSpec } from '../../types';

export const edgeDetectionNodeSpec: NodeSpec = {
  id: 'edge-detection',
  category: 'Effects',
  displayName: 'Edge Detection',
  description: 'Detects edges and creates outline effects for structural definition',
  icon: 'focus',
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
    edgeThreshold: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Threshold'
    },
    edgeWidth: {
      type: 'float',
      default: 0.01,
      min: 0.0,
      max: 0.1,
      step: 0.01,
      label: 'Width'
    },
    edgeIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    edgeStrength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Strength'
    }
  },
  parameterGroups: [
    {
      id: 'edge-main',
      label: 'Edge Detection',
      parameters: ['edgeThreshold', 'edgeWidth', 'edgeIntensity', 'edgeStrength'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// Simplified edge detection using threshold-based approach
float edgeEffect(float value, float threshold, float width) {
  float edge = abs(value - threshold);
  return smoothstep(0.0, width, edge);
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Apply edge detection
  float edges = edgeEffect(value, $param.edgeThreshold, $param.edgeWidth);
  float result = mix(value, edges * $param.edgeIntensity, $param.edgeStrength);
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
