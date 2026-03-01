import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Input Nodes - provide basic inputs like UV coordinates, time, resolution, and constants
 */

export const uvCoordinatesNodeSpec: NodeSpec = {
  id: 'uv-coordinates',
  category: 'Inputs',
  displayName: 'UV Coords',
  description: 'Outputs normalized UV coordinates (0-1)',
  icon: 'chart-scatter',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {},
  mainCode: `
    // Output normalized screen space coordinates (p from base shader template)
    $output.out = p;
  `
};

export const timeNodeSpec: NodeSpec = {
  id: 'time',
  category: 'Inputs',
  displayName: 'Time',
  description: 'Outputs the current time value',
  icon: 'time-clock',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Time'
    }
  ],
  parameters: {},
  mainCode: `
    // Output time
    $output.out = $time;
  `
};

export const resolutionNodeSpec: NodeSpec = {
  id: 'resolution',
  category: 'Inputs',
  displayName: 'Resolution',
  description: 'Outputs the screen resolution as vec2',
  icon: 'chart-scatter',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'vec2',
      label: 'Resolution'
    }
  ],
  parameters: {},
  mainCode: `
    // Output resolution
    $output.out = $resolution;
  `
};

export const fragmentCoordinatesNodeSpec: NodeSpec = {
  id: 'fragment-coordinates',
  category: 'Inputs',
  displayName: 'Frag Coords',
  description: 'Outputs the fragment coordinates (gl_FragCoord.xy)',
  icon: 'chart-scatter',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'vec2',
      label: 'Frag coords'
    }
  ],
  parameters: {},
  mainCode: `
    // Output fragment coordinates
    $output.out = gl_FragCoord.xy;
  `
};

export const constantFloatNodeSpec: NodeSpec = {
  id: 'constant-float',
  category: 'Inputs',
  displayName: 'Float',
  description: 'Outputs a constant float value',
  icon: 'constant',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Value'
    }
  ],
  parameters: {
    value: {
      type: 'float',
      default: 0.5,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'Value'
    }
  },
  parameterLayout: {
    elements: [
      { type: 'grid', parameters: ['value'], parameterUI: { value: 'input' } }
    ]
  },
  mainCode: `
    // Output constant float value
    $output.out = $param.value;
  `
};

export const constantVec2NodeSpec: NodeSpec = {
  id: 'constant-vec2',
  category: 'Inputs',
  displayName: 'Vec2',
  description: 'Outputs a constant vec2 value',
  icon: 'vector-two',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {
    x: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'X'
    },
    y: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'Y'
    }
  },
  parameterLayout: {
    minColumns: 1,
    elements: [
      { type: 'grid', parameters: ['x', 'y'], parameterUI: { x: 'input', y: 'input' }, layout: { columns: 1 } }
    ]
  },
  mainCode: `
    // Output constant vec2 value
    $output.out = vec2($param.x, $param.y);
  `
};

export const constantVec3NodeSpec: NodeSpec = {
  id: 'constant-vec3',
  category: 'Inputs',
  displayName: 'Vec3',
  description: 'Outputs a constant vec3 value',
  icon: 'vector-three',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'vec3',
      label: 'Color'
    }
  ],
  parameters: {
    x: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'X'
    },
    y: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'Y'
    },
    z: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'Z'
    }
  },
  parameterLayout: {
    minColumns: 1,
    elements: [
      { type: 'grid', parameters: ['x', 'y', 'z'], parameterUI: { x: 'input', y: 'input', z: 'input' }, layout: { columns: 1 } }
    ]
  },
  mainCode: `
    // Output constant vec3 value
    $output.out = vec3($param.x, $param.y, $param.z);
  `
};

export const constantVec4NodeSpec: NodeSpec = {
  id: 'constant-vec4',
  category: 'Inputs',
  displayName: 'Vec4',
  description: 'Outputs a constant vec4 value',
  icon: 'chart-scatter-3d',
  inputs: [],
  outputs: [
    {
      name: 'out',
      type: 'vec4',
      label: 'Color'
    }
  ],
  parameters: {
    x: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'X'
    },
    y: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'Y'
    },
    z: {
      type: 'float',
      default: 0.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'Z'
    },
    w: {
      type: 'float',
      default: 1.0,
      min: -1000.0,
      max: 1000.0,
      step: 0.01,
      label: 'W'
    }
  },
  parameterLayout: {
    minColumns: 1,
    elements: [
      { type: 'grid', parameters: ['x', 'y', 'z', 'w'], parameterUI: { x: 'input', y: 'input', z: 'input', w: 'input' }, layout: { columns: 1 } }
    ]
  },
  mainCode: `
    // Output constant vec4 value
    $output.out = vec4($param.x, $param.y, $param.z, $param.w);
  `
};
