import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Color Map — maps a scalar to grayscale vec3 (R = G = B). No hue or palette stops;
 * use OKLCH Color Map nodes for ramps, bands, and dithering.
 */
export const colorMapNodeSpec: NodeSpec = {
  id: 'color-map',
  category: 'Blend',
  displayName: 'Color Map',
  description:
    'Float to grayscale vec3 only (no hue or stops). Use OKLCH Color Map Smooth or Stepped for ramps and bands.',
  icon: 'color-swatch',
  inputs: [
    {
      name: 'in',
      type: 'float'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec3'
    }
  ],
  parameters: {},
  mainCode: `
    // Convert float to grayscale vec3
    $output.out = vec3($input.in);
  `
};
