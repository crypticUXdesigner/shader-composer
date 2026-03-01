import type { NodeSpec } from '../../types/nodeSpec';

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
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {
    operation: {
      type: 'int',
      default: 0,
      min: 0,
      max: 5,
      label: 'Operation'
    },
    b: { type: 'float', default: 0.5, min: -1000.0, max: 1000.0, step: 0.01, label: 'Compare Value' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['operation', 'b'],
        layout: { columns: 1 }
      }
    ],
    minColumns: 2
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
    { name: 'condition', type: 'float', label: 'Condition' },
    { name: 'trueValue', type: 'float', fallbackParameter: 'trueValue', label: 'If true' },
    { name: 'falseValue', type: 'float', fallbackParameter: 'falseValue', label: 'If false' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {
    trueValue: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'True Value' },
    falseValue: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'False Value' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['trueValue', 'falseValue'],
        layout: { columns: 1 }
      }
    ],
    minColumns: 2
  },
  mainCode: `
    $output.out = ($input.condition > 0.5) ? $input.trueValue : $input.falseValue;
  `
};

/** Composites foreground over background using a mask (float). Dark = bg, bright = fg. */
export const maskCompositeFloatNodeSpec: NodeSpec = {
  id: 'mask-composite-float',
  category: 'Mask',
  displayName: 'Mask BW',
  description: 'Composites foreground over background using a mask. Dark areas show background, bright areas show foreground.',
  icon: 'mask',
  inputs: [
    { name: 'bg', type: 'float', fallbackParameter: 'bg', label: 'Background' },
    { name: 'mask', type: 'float', fallbackParameter: 'mask', label: 'Mask' },
    { name: 'fg', type: 'float', fallbackParameter: 'fg', label: 'Foreground' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {
    bg: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Background' },
    mask: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Mask' },
    fg: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Foreground' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['bg', 'mask', 'fg'],
        layout: { columns: 3 }
      }
    ]
  },
  mainCode: `
    $output.out = mix($input.bg, $input.fg, $input.mask);
  `
};

/** Composites colored foreground over colored background using a mask (vec3). */
export const maskCompositeVec3NodeSpec: NodeSpec = {
  id: 'mask-composite-vec3',
  category: 'Mask',
  displayName: 'Mask Color',
  description: 'Composites colored foreground over colored background using a mask. Dark areas show background, bright areas show foreground.',
  icon: 'mask',
  inputs: [
    { name: 'bg', type: 'vec3', label: 'Background' },
    { name: 'mask', type: 'float', fallbackParameter: 'mask', label: 'Mask' },
    { name: 'fg', type: 'vec3', label: 'Foreground' }
  ],
  outputs: [
    { name: 'out', type: 'vec3', label: 'Color' }
  ],
  parameters: {
    mask: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Mask' }
  },
  parameterLayout: {
    elements: [{ type: 'auto-grid' }],
    minColumns: 2
  },
  mainCode: `
    $output.out = mix($input.bg, $input.fg, $input.mask);
  `
};

// Note: gradient-mask node has been migrated to a native NodeSpec (if it exists).
// All VisualElements have been converted to native NodeSpecs.
