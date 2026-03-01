import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Math: trigonometric and exponential/logarithmic
 */

export const sineNodeSpec: NodeSpec = {
  id: 'sine',
  category: 'Math',
  displayName: 'Sine',
  description: 'Sine function',
  icon: 'trig-wave',
  inputs: [{ name: 'in', type: 'float', label: 'Angle' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = sin($input.in);`
};

export const cosineNodeSpec: NodeSpec = {
  id: 'cosine',
  category: 'Math',
  displayName: 'Cosine',
  description: 'Cosine function',
  icon: 'math-cos',
  inputs: [{ name: 'in', type: 'float', label: 'Angle' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = cos($input.in);`
};

export const tangentNodeSpec: NodeSpec = {
  id: 'tangent',
  category: 'Math',
  displayName: 'Tangent',
  description: 'Tangent function',
  icon: 'math-tg',
  inputs: [{ name: 'in', type: 'float', label: 'Angle' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = tan($input.in);`
};

export const arcSineNodeSpec: NodeSpec = {
  id: 'arc-sine',
  category: 'Math',
  displayName: 'Arc Sine',
  description: 'Arc sine (inverse sine)',
  icon: 'math-function-y',
  inputs: [{ name: 'in', type: 'float', label: 'Angle' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = asin($input.in);`
};

export const arcCosineNodeSpec: NodeSpec = {
  id: 'arc-cosine',
  category: 'Math',
  displayName: 'Arc Cosine',
  description: 'Arc cosine (inverse cosine)',
  icon: 'math-function-y',
  inputs: [{ name: 'in', type: 'float', label: 'Angle' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = acos($input.in);`
};

export const arcTangentNodeSpec: NodeSpec = {
  id: 'arc-tangent',
  category: 'Math',
  displayName: 'Arc Tangent',
  description: 'Arc tangent (inverse tangent)',
  icon: 'math-function-y',
  inputs: [{ name: 'in', type: 'float', label: 'Angle' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = atan($input.in);`
};

export const arcTangent2NodeSpec: NodeSpec = {
  id: 'arc-tangent-2',
  category: 'Math',
  displayName: 'Arc Tangent 2',
  description: 'Arc tangent of y/x (handles all quadrants)',
  icon: 'math-symbols',
  inputs: [
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'x', type: 'float', fallbackParameter: 'x', label: 'X' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    x: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'X Component' }
  },
  mainCode: `$output.out = atan($input.y, $input.x);`
};

export const exponentialNodeSpec: NodeSpec = {
  id: 'exponential',
  category: 'Math',
  displayName: 'Exponential',
  description: 'e raised to the power of input',
  icon: 'math-xy',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = exp($input.in);`
};

export const naturalLogarithmNodeSpec: NodeSpec = {
  id: 'natural-logarithm',
  category: 'Math',
  displayName: 'Natural Logarithm',
  description: 'Natural logarithm (base e)',
  icon: 'math-function',
  inputs: [{ name: 'in', type: 'float', label: 'Value' }],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = log($input.in);`
};
