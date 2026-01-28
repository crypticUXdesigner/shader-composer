import type { NodeSpec } from '../../types';

/**
 * Final Output Node
 * Marks a node as the final output for the shader.
 * This is a terminal node that marks where the rendering pipeline ends.
 * The compiler uses the input connection to determine the final shader output.
 */
export const finalOutputNodeSpec: NodeSpec = {
  id: 'final-output',
  category: 'Output',
  displayName: 'Output',
  description: 'Marks the final output for the shader. Converts input to color.',
  inputs: [
    {
      name: 'in',
      type: 'vec3'  // Accepts vec3 (use color-map node before this for float inputs)
    }
  ],
  outputs: [],  // Terminal node - no outputs
  parameters: {},
  mainCode: ''  // No code needed - compiler uses input connection directly
};
