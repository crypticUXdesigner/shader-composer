import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Math primitives: arithmetic, rounding, min/max, clamp, mix, step, smoothstep
 */

export const addNodeSpec: NodeSpec = {
  id: 'add',
  category: 'Math',
  displayName: 'Add',
  description: 'Adds two values together',
  icon: 'plus',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Second Value' }
  },
  mainCode: `$output.out = $input.a + $input.b;`
};

export const subtractNodeSpec: NodeSpec = {
  id: 'subtract',
  category: 'Math',
  displayName: 'Subtract',
  description: 'Subtracts second value from first',
  icon: 'minus',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Second Value' }
  },
  mainCode: `$output.out = $input.a - $input.b;`
};

export const multiplyNodeSpec: NodeSpec = {
  id: 'multiply',
  category: 'Math',
  displayName: 'Multiply',
  description: 'Multiplies two values',
  icon: 'multiply-x',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Multiplier' }
  },
  mainCode: `$output.out = $input.a * $input.b;`
};

export const divideNodeSpec: NodeSpec = {
  id: 'divide',
  category: 'Math',
  displayName: 'Divide',
  description: 'Divides first value by second',
  icon: 'divide',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Divisor' }
  },
  mainCode: `$output.out = $input.a / $input.b;`
};

export const powerNodeSpec: NodeSpec = {
  id: 'power',
  category: 'Math',
  displayName: 'Power',
  description: 'Raises first value to the power of second',
  icon: 'power',
  inputs: [
    { name: 'base', type: 'float', label: 'Base' },
    { name: 'exponent', type: 'float', fallbackParameter: 'exponent', label: 'Exponent' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    exponent: { type: 'float', default: 2.0, min: -100.0, max: 100.0, step: 0.01, label: 'Exponent' }
  },
  mainCode: `$output.out = pow($input.base, $input.exponent);`
};

export const squareRootNodeSpec: NodeSpec = {
  id: 'square-root',
  category: 'Math',
  displayName: 'Square Root',
  description: 'Square root of input',
  icon: 'sqrt',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = sqrt($input.in);`
};

export const absoluteNodeSpec: NodeSpec = {
  id: 'absolute',
  category: 'Math',
  displayName: 'Absolute',
  description: 'Absolute value of input',
  icon: 'arrows-left-right',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = abs($input.in);`
};

export const floorNodeSpec: NodeSpec = {
  id: 'floor',
  category: 'Math',
  displayName: 'Floor',
  description: 'Floor (round down) of input',
  icon: 'arrow-down',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = floor($input.in);`
};

export const ceilNodeSpec: NodeSpec = {
  id: 'ceil',
  category: 'Math',
  displayName: 'Ceil',
  description: 'Ceiling (round up) of input',
  icon: 'arrow-up',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = ceil($input.in);`
};

export const fractNodeSpec: NodeSpec = {
  id: 'fract',
  category: 'Math',
  displayName: 'Fract',
  description: 'Fractional part of input',
  icon: 'hash',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = fract($input.in);`
};

export const moduloNodeSpec: NodeSpec = {
  id: 'modulo',
  category: 'Math',
  displayName: 'Modulo',
  description: 'Modulo (remainder) operation',
  icon: 'percentage',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 1.0, min: 0.001, max: 1000.0, step: 0.01, label: 'Divisor' }
  },
  mainCode: `$output.out = mod($input.a, $input.b);`
};

export const minNodeSpec: NodeSpec = {
  id: 'min',
  category: 'Math',
  displayName: 'Min',
  description: 'Minimum of two values',
  icon: 'math-min',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Second Value' }
  },
  mainCode: `$output.out = min($input.a, $input.b);`
};

export const maxNodeSpec: NodeSpec = {
  id: 'max',
  category: 'Math',
  displayName: 'Max',
  description: 'Maximum of two values',
  icon: 'math-max',
  inputs: [
    { name: 'a', type: 'float', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    b: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Second Value' }
  },
  mainCode: `$output.out = max($input.a, $input.b);`
};

export const clampNodeSpec: NodeSpec = {
  id: 'clamp',
  category: 'Math',
  displayName: 'Clamp',
  description: 'Clamps value between min and max',
  icon: 'math-max-min',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' },
    { name: 'min', type: 'float', fallbackParameter: 'min', label: 'Minimum' },
    { name: 'max', type: 'float', fallbackParameter: 'max', label: 'Maximum' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    min: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Minimum' },
    max: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Maximum' }
  },
  mainCode: `$output.out = clamp($input.in, $input.min, $input.max);`
};

export const mixNodeSpec: NodeSpec = {
  id: 'mix',
  category: 'Math',
  displayName: 'Mix',
  description: 'Linear interpolation between two values',
  icon: 'arrows-left-right',
  inputs: [
    { name: 'a', type: 'float', fallbackParameter: 'a', label: 'First value' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'Second value' },
    { name: 't', type: 'float', fallbackParameter: 't', label: 'Factor' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    a: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Start' },
    b: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'End' },
    t: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Factor' }
  },
  mainCode: `$output.out = mix($input.a, $input.b, $input.t);`
};

export const stepNodeSpec: NodeSpec = {
  id: 'step',
  category: 'Math',
  displayName: 'Step',
  description: 'Step function (0.0 if x < edge, 1.0 otherwise)',
  icon: 'arrow-right',
  inputs: [
    { name: 'edge', type: 'float', fallbackParameter: 'edge', label: 'Threshold' },
    { name: 'x', type: 'float', label: 'Value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    edge: { type: 'float', default: 0.5, min: -1000.0, max: 1000.0, step: 0.01, label: 'Threshold' }
  },
  mainCode: `$output.out = step($input.edge, $input.x);`
};

export const smoothstepNodeSpec: NodeSpec = {
  id: 'smoothstep',
  category: 'Math',
  displayName: 'Smoothstep',
  description: 'Smooth Hermite interpolation between edge0 and edge1',
  icon: 'wave-sine',
  inputs: [
    { name: 'edge0', type: 'float', fallbackParameter: 'edge0', label: 'Lower edge' },
    { name: 'edge1', type: 'float', fallbackParameter: 'edge1', label: 'Upper edge' },
    { name: 'x', type: 'float', label: 'Value' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    edge0: { type: 'float', default: 0.0, min: 0, max: 1, step: 0.01, label: 'Lower Edge' },
    edge1: { type: 'float', default: 1.0, min: 0, max: 1, step: 0.01, label: 'Upper Edge' }
  },
  mainCode: `$output.out = smoothstep($input.edge0, $input.edge1, $input.x);`
};
