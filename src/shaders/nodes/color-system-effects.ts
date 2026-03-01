import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Color system effects: tone mapping
 */

export const toneMappingNodeSpec: NodeSpec = {
  id: 'tone-mapping',
  category: 'Effects',
  displayName: 'Tone Mapping',
  description: 'Applies tone mapping adjustments (exposure, contrast, saturation) to color',
  icon: 'contrast-2',
  inputs: [
    { name: 'in', type: 'vec3', label: 'Color' }
  ],
  outputs: [
    { name: 'out', type: 'vec3', label: 'Color' }
  ],
  parameters: {
    exposure: { type: 'float', default: 1.0, min: 0.0, max: 5.0, step: 0.01, label: 'Exposure' },
    contrast: { type: 'float', default: 1.0, min: 0.0, max: 2.0, step: 0.01, label: 'Contrast' },
    saturation: { type: 'float', default: 1.0, min: 0.0, max: 2.0, step: 0.01, label: 'Saturation' }
  },
  mainCode: `
    vec3 color = $input.in;
    color *= $param.exposure;
    color = (color - 0.5) * $param.contrast + 0.5;
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luminance), color, $param.saturation);
    $output.out = clamp(color, 0.0, 1.0);
  `
};
