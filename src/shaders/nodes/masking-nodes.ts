import type { NodeSpec } from '../../types';

/**
 * Masking/Control Nodes
 */

export const compareNodeSpec: NodeSpec = {
  id: 'compare',
  category: 'Mask',
  displayName: 'Compare',
  description: 'Compares two values and outputs 0.0 or 1.0',
  icon: 'compare',
  inputs: [
    { name: 'a', type: 'float' },
    { name: 'b', type: 'float' }
  ],
  outputs: [
    { name: 'out', type: 'float' }
  ],
  parameters: {
    operation: {
      type: 'int',
      default: 0,
      min: 0,
      max: 5
    }
  },
  mainCode: `
    if ($param.operation == 0) {
      $output.out = ($input.a == $input.b) ? 1.0 : 0.0;
    } else if ($param.operation == 1) {
      $output.out = ($input.a != $input.b) ? 1.0 : 0.0;
    } else if ($param.operation == 2) {
      $output.out = ($input.a < $input.b) ? 1.0 : 0.0;
    } else if ($param.operation == 3) {
      $output.out = ($input.a <= $input.b) ? 1.0 : 0.0;
    } else if ($param.operation == 4) {
      $output.out = ($input.a > $input.b) ? 1.0 : 0.0;
    } else {
      $output.out = ($input.a >= $input.b) ? 1.0 : 0.0;
    }
  `
};

export const selectNodeSpec: NodeSpec = {
  id: 'select',
  category: 'Mask',
  displayName: 'Select',
  description: 'Selects between two values based on condition',
  icon: 'select',
  inputs: [
    { name: 'condition', type: 'float' },
    { name: 'trueValue', type: 'float' },
    { name: 'falseValue', type: 'float' }
  ],
  outputs: [
    { name: 'out', type: 'float' }
  ],
  parameters: {},
  mainCode: `
    $output.out = ($input.condition > 0.5) ? $input.trueValue : $input.falseValue;
  `
};

// Note: gradient-mask node has been migrated to a native NodeSpec (if it exists).
// All VisualElements have been converted to native NodeSpecs.
