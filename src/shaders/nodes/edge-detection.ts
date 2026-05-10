import type { NodeSpec } from '../../types/nodeSpec';

export const edgeDetectionNodeSpec: NodeSpec = {
  id: 'edge-detection',
  category: 'Effects',
  displayName: 'Edge Detection',
  description:
    'Luminance ridge around a Threshold (not Sobel/neighbor convolution). Outputs mix of source and ridge; preserves chroma by scaling RGB from luma.',
  icon: 'focus',
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
      label: 'Edges'
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
      label: 'Edges',
      parameters: ['edgeThreshold', 'edgeWidth', 'edgeIntensity', 'edgeStrength'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['edgeThreshold', 'edgeWidth', 'edgeIntensity', 'edgeStrength'],
        layout: { columns: 'auto' }
      }
    ]
  },
  functions: `
// Simplified edge detection using threshold-based approach
float edgeEffect(float value, float threshold, float width) {
  float edge = abs(value - threshold);
  return smoothstep(0.0, width, edge);
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float edges = edgeEffect(lum, $param.edgeThreshold, $param.edgeWidth);
  float blendedLum = mix(lum, edges * $param.edgeIntensity, $param.edgeStrength);
  vec3 resultRgb = lum > 1e-4 ? clamp(color * (blendedLum / lum), 0.0, 1.0) : vec3(blendedLum);
  $output.out = vec4(resultRgb, inColor.a);
`
};
