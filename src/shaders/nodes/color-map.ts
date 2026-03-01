import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Color Map Node
 * Converts a float value to vec3 color (grayscale or with color mapping)
 */
export const colorMapNodeSpec: NodeSpec = {
  id: 'color-map',
  category: 'Blend',
  displayName: 'Color Map',
  description: 'Converts float value to vec3 color (grayscale)',
  icon: 'color-swatch',
  inputs: [
    {
      name: 'in',
      type: 'float',
      label: 'Value'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec3',
      label: 'Color'
    }
  ],
  parameters: {},
  mainCode: `
    // Convert float to grayscale vec3
    $output.out = vec3($input.in);
  `
};
