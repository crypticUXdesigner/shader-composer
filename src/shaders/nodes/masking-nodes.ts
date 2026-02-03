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
    { name: 'b', type: 'float', fallbackParameter: 'b' }
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
    },
    b: { type: 'float', default: 0.5, min: -1000.0, max: 1000.0, step: 0.01, label: 'B' }
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
    { name: 'trueValue', type: 'float', fallbackParameter: 'trueValue' },
    { name: 'falseValue', type: 'float', fallbackParameter: 'falseValue' }
  ],
  outputs: [
    { name: 'out', type: 'float' }
  ],
  parameters: {
    trueValue: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'True' },
    falseValue: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'False' }
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
    { name: 'bg', type: 'float', fallbackParameter: 'bg' },
    { name: 'mask', type: 'float', fallbackParameter: 'mask' },
    { name: 'fg', type: 'float', fallbackParameter: 'fg' }
  ],
  outputs: [
    { name: 'out', type: 'float' }
  ],
  parameters: {
    bg: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Bg' },
    mask: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Mask' },
    fg: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Fg' }
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
    { name: 'bg', type: 'vec3' },
    { name: 'mask', type: 'float', fallbackParameter: 'mask' },
    { name: 'fg', type: 'vec3' }
  ],
  outputs: [
    { name: 'out', type: 'vec3' }
  ],
  parameters: {
    mask: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Mask' }
  },
  mainCode: `
    $output.out = mix($input.bg, $input.fg, $input.mask);
  `
};

// Note: gradient-mask node has been migrated to a native NodeSpec (if it exists).
// All VisualElements have been converted to native NodeSpecs.
