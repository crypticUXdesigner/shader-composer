import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Math: vector operations (length, distance, dot, cross, normalize, reflect, refract)
 */

export const lengthNodeSpec: NodeSpec = {
  id: 'length',
  category: 'Math',
  displayName: 'Length',
  description: 'Length (magnitude) of vector',
  icon: 'ruler',
  inputs: [{ name: 'in', type: 'vec2', label: 'Vector' }],
  outputs: [{ name: 'out', type: 'float', label: 'Length' }],
  parameters: {},
  mainCode: `$output.out = length($input.in);`
};

export const distanceNodeSpec: NodeSpec = {
  id: 'distance',
  category: 'Math',
  displayName: 'Distance',
  description: 'Distance between two points',
  icon: 'ruler',
  inputs: [
    { name: 'a', type: 'vec2', label: 'First vector' },
    { name: 'b', type: 'vec2', fallbackParameter: 'bX,bY', label: 'Second vector' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {
    bX: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Target X' },
    bY: { type: 'float', default: 0.0, min: -1000.0, max: 1000.0, step: 0.01, label: 'Target Y' }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['bX', 'bY'],
        parameterUI: { bX: 'coords', bY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      }
    ]
  },
  mainCode: `$output.out = distance($input.a, $input.b);`
};

export const dotProductNodeSpec: NodeSpec = {
  id: 'dot-product',
  category: 'Math',
  displayName: 'Dot Product',
  description: 'Dot product of two vectors',
  icon: 'vector-dot',
  inputs: [
    { name: 'a', type: 'vec2', label: 'First vector' },
    { name: 'b', type: 'vec2', label: 'Second vector' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = dot($input.a, $input.b);`
};

export const crossProductNodeSpec: NodeSpec = {
  id: 'cross-product',
  category: 'Math',
  displayName: 'Cross Product',
  description: 'Cross product of two 3D vectors',
  icon: 'vector-cross',
  inputs: [
    { name: 'a', type: 'vec3', label: 'First vector' },
    { name: 'b', type: 'vec3', label: 'Second vector' }
  ],
  outputs: [{ name: 'out', type: 'vec3', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = cross($input.a, $input.b);`
};

export const normalizeNodeSpec: NodeSpec = {
  id: 'normalize',
  category: 'Math',
  displayName: 'Normalize',
  description: 'Normalizes vector to unit length',
  icon: 'normalize',
  inputs: [{ name: 'in', type: 'vec2', label: 'Vector' }],
  outputs: [{ name: 'out', type: 'vec2', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = normalize($input.in);`
};

export const reflectNodeSpec: NodeSpec = {
  id: 'reflect',
  category: 'Math',
  displayName: 'Reflect',
  description: 'Reflects vector off surface with normal',
  icon: 'calculator',
  inputs: [
    { name: 'I', type: 'vec2', label: 'Incident' },
    { name: 'N', type: 'vec2', label: 'Normal' }
  ],
  outputs: [{ name: 'out', type: 'vec2', label: 'Result' }],
  parameters: {},
  mainCode: `$output.out = reflect($input.I, $input.N);`
};

export const refractNodeSpec: NodeSpec = {
  id: 'refract',
  category: 'Math',
  displayName: 'Refract',
  description: 'Refracts vector through surface',
  icon: 'calculator',
  inputs: [
    { name: 'I', type: 'vec2', label: 'Incident' },
    { name: 'N', type: 'vec2', label: 'Normal' },
    { name: 'eta', type: 'float', fallbackParameter: 'eta', label: 'Ratio' }
  ],
  outputs: [{ name: 'out', type: 'vec2', label: 'Result' }],
  parameters: {
    eta: { type: 'float', default: 0.92, min: 0.01, max: 2.0, step: 0.01, label: 'Eta (IOR)' }
  },
  mainCode: `$output.out = refract($input.I, $input.N, $input.eta);`
};
