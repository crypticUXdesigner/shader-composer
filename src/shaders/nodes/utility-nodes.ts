import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Utility Nodes
 */

export const oneMinusNodeSpec: NodeSpec = {
  id: 'one-minus',
  category: 'Utilities',
  displayName: 'One Minus',
  description: 'Subtracts input from 1.0 (invert for 0-1 range)',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = 1.0 - $input.in;
  `
};

export const negateNodeSpec: NodeSpec = {
  id: 'negate',
  category: 'Utilities',
  displayName: 'Negate',
  description: 'Negates input value',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = -$input.in;
  `
};

export const reciprocalNodeSpec: NodeSpec = {
  id: 'reciprocal',
  category: 'Utilities',
  displayName: 'Reciprocal',
  description: 'Reciprocal (1.0 / input)',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = 1.0 / $input.in;
  `
};

export const clamp01NodeSpec: NodeSpec = {
  id: 'clamp-01',
  category: 'Utilities',
  displayName: 'Clamp 01',
  description: 'Clamps value to 0.0-1.0 range',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = clamp($input.in, 0.0, 1.0);
  `
};

export const saturateNodeSpec: NodeSpec = {
  id: 'saturate',
  category: 'Utilities',
  displayName: 'Saturate',
  description: 'Same as Clamp 01 (common shader term)',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = clamp($input.in, 0.0, 1.0);
  `
};

export const signNodeSpec: NodeSpec = {
  id: 'sign',
  category: 'Utilities',
  displayName: 'Sign',
  description: 'Returns sign of value (-1.0, 0.0, or 1.0)',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = sign($input.in);
  `
};

export const roundNodeSpec: NodeSpec = {
  id: 'round',
  category: 'Utilities',
  displayName: 'Round',
  description: 'Rounds to nearest integer',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = round($input.in);
  `
};

export const truncateNodeSpec: NodeSpec = {
  id: 'truncate',
  category: 'Utilities',
  displayName: 'Truncate',
  description: 'Truncates (removes fractional part)',
  icon: 'settings-2',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {},
  mainCode: `
    $output.out = trunc($input.in);
  `
};

export const lerpNodeSpec: NodeSpec = {
  id: 'lerp',
  category: 'Utilities',
  displayName: 'Lerp',
  description: 'Linear interpolation (alias for Mix)',
  icon: 'settings-2',
  inputs: [
    { name: 'a', type: 'float', fallbackParameter: 'a', label: 'Start' },
    { name: 'b', type: 'float', fallbackParameter: 'b', label: 'End' },
    { name: 't', type: 'float', fallbackParameter: 't', label: 'Factor' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Result' }
  ],
  parameters: {
    a: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Start' },
    b: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'End' },
    t: { type: 'float', default: 0.5, min: 0.0, max: 1.0, step: 0.01, label: 'Factor' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['a', 'b', 't'],
        layout: { columns: 2, parameterSpan: { a: 2, b: 2, t: 2 } }
      }
    ]
  },
  mainCode: `
    $output.out = mix($input.a, $input.b, $input.t);
  `
};

export const swizzleNodeSpec: NodeSpec = {
  id: 'swizzle',
  category: 'Utilities',
  displayName: 'Swizzle',
  description: 'Reorders/swizzles vector components (supports common patterns)',
  icon: 'arrows-right-left',
  inputs: [
    { name: 'in', type: 'vec4', label: 'Vector' }
  ],
  outputs: [
    { name: 'out', type: 'vec4', label: 'Result' }
  ],
  parameters: {
    swizzle: {
      type: 'string',
      default: 'xyzw',
      label: 'Pattern'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['swizzle'],
        layout: { columns: 2, parameterSpan: { swizzle: 2 } }
      }
    ]
  },
  mainCode: `
    // Swizzle pattern - supports common 2, 3, and 4 component patterns
    // Output is vec4, compiler will handle type promotion/demotion
    // Common patterns: "xy", "yx", "xyz", "zyx", "xyzw", "wzyx", "rgba", "abgr"
    // This uses conditional logic for common patterns - full implementation would parse the string
    // For now, output vec4 and let compiler handle type conversion
    vec4 v = $input.in;
    if ($param.swizzle == "xy") {
      $output.out = vec4(v.xy, 0.0, 1.0);
    } else if ($param.swizzle == "yx") {
      $output.out = vec4(v.yx, 0.0, 1.0);
    } else if ($param.swizzle == "xyz") {
      $output.out = vec4(v.xyz, 1.0);
    } else if ($param.swizzle == "zyx") {
      $output.out = vec4(v.zyx, 1.0);
    } else if ($param.swizzle == "xyzw") {
      $output.out = v.xyzw;
    } else if ($param.swizzle == "wzyx") {
      $output.out = v.wzyx;
    } else {
      // Default: pass through
      $output.out = v;
    }
  `
};

export const splitVectorNodeSpec: NodeSpec = {
  id: 'split-vector',
  category: 'Utilities',
  displayName: 'Split Vector',
  description: 'Splits vector into components',
  icon: 'layers-difference',
  inputs: [
    { name: 'in', type: 'vec4', label: 'Vector' }
  ],
  outputs: [
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'z', type: 'float', label: 'Z' },
    { name: 'w', type: 'float', label: 'W' }
  ],
  parameters: {},
  parameterLayout: {
    elements: [
      { type: 'grid', parameters: [], layout: { columns: 2 } }
    ]
  },
  mainCode: `
    $output.x = $input.in.x;
    $output.y = $input.in.y;
    $output.z = $input.in.z;
    $output.w = $input.in.w;
  `
};

export const combineVectorNodeSpec: NodeSpec = {
  id: 'combine-vector',
  category: 'Utilities',
  displayName: 'Combine Vector',
  description: 'Combines floats into vector',
  icon: 'layers-union',
  inputs: [
    { name: 'x', type: 'float', label: 'X' },
    { name: 'y', type: 'float', label: 'Y' },
    { name: 'z', type: 'float', fallbackParameter: 'z', label: 'Z' },
    { name: 'w', type: 'float', fallbackParameter: 'w', label: 'W' }
  ],
  outputs: [
    { name: 'out', type: 'vec4', label: 'Vector' }
  ],
  parameters: {
    outputType: {
      type: 'int',
      default: 2,
      min: 2,
      max: 4,
      label: 'Output Type'
    },
    z: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Z Component' },
    w: { type: 'float', default: 1.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'W Component' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['outputType', 'z', 'w'],
        layout: { columns: 2, parameterSpan: { outputType: 2, z: 2, w: 2 } }
      }
    ]
  },
  mainCode: `
    // Output type is vec4, compiler will handle promotion/demotion based on connections
    if ($param.outputType == 2) {
      $output.out = vec4($input.x, $input.y, 0.0, 1.0);
    } else if ($param.outputType == 3) {
      $output.out = vec4($input.x, $input.y, $input.z, 1.0);
    } else {
      $output.out = vec4($input.x, $input.y, $input.z, $input.w);
    }
  `
};
