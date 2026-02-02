import type { NodeSpec } from '../../types';

export const vectorFieldNodeSpec: NodeSpec = {
  id: 'vector-field',
  category: 'Distort',
  displayName: 'Vector Field',
  icon: 'arrow-up-right',
  description: 'Vector field that distorts UV coordinates, creating warping effects',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
    }
  ],
  parameters: {
    vectorFieldFrequencyX: {
      type: 'float',
      default: 4.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Frequency X'
    },
    vectorFieldFrequencyY: {
      type: 'float',
      default: 2.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Frequency Y'
    },
    vectorFieldFrequencyZ: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Frequency Z'
    },
    vectorFieldAmplitude: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Amplitude'
    },
    vectorFieldRadialStrength: {
      type: 'float',
      default: 8.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Radial Strength'
    },
    vectorFieldHarmonicAmplitude: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: 'Harmonics'
    },
    vectorFieldComplexity: {
      type: 'float',
      default: 6.0,
      min: 1.0,
      max: 15.0,
      step: 0.1,
      label: 'Complexity'
    },
    vectorFieldDistanceContribution: {
      type: 'float',
      default: 0.04,
      min: 0.0,
      max: 0.2,
      step: 0.01,
      label: 'Distance'
    },
    vectorFieldSpeed: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: 'Speed',
      inputMode: 'override'
    },
    animationSpeed: {
      type: 'float',
      default: 0.3,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: 'Speed'
    }
  },
  parameterGroups: [
    {
      id: 'vector-field',
      label: 'Vector Field',
      parameters: [
        'vectorFieldFrequencyX',
        'vectorFieldFrequencyY',
        'vectorFieldFrequencyZ',
        'vectorFieldAmplitude',
        'vectorFieldRadialStrength',
        'vectorFieldHarmonicAmplitude',
        'vectorFieldComplexity',
        'vectorFieldDistanceContribution'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'animation',
      label: 'Animation',
      parameters: ['vectorFieldSpeed', 'animationSpeed'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
vec2 vectorField(vec2 p) {
  // Vector field speed
  float vectorFieldSpeed = $param.vectorFieldSpeed;
  float vectorFieldTime = $time * $param.animationSpeed * vectorFieldSpeed;
  
  // Pre-calculate all uniform-dependent values
  vec2 frequencies = vec2($param.vectorFieldFrequencyX, $param.vectorFieldFrequencyY);
  float radialStrength = $param.vectorFieldRadialStrength;
  float amplitude = $param.vectorFieldAmplitude;
  float complexity = clamp($param.vectorFieldComplexity, 1.0, 15.0);
  float harmonicAmp = $param.vectorFieldHarmonicAmplitude;
  float distContrib = $param.vectorFieldDistanceContribution;
  
  // Distance for radial calculation
  float d = length(p);
  
  // Vector field calculation (adapted from sphere-raymarch for 2D)
  // In 2D, we use vec2 instead of vec3, and 2D cross product equivalent
  vec2 a = normalize(cos(frequencies + vectorFieldTime - d * radialStrength));
  
  // 2D equivalent of: a * dot(a, pos) - cross(a, pos) * amplitude
  // In 2D, cross product of (a.x, a.y) and (p.x, p.y) is a.x * p.y - a.y * p.x
  // The perpendicular vector is (-a.y, a.x)
  vec2 perpendicular = vec2(-a.y, a.x);
  float crossProduct = a.x * p.y - a.y * p.x;
  a = a * dot(a, p) - perpendicular * amplitude;
  
  // Harmonic layers (2D version)
  for(float j = 1.0; j < 15.0; j++) {
    if (j >= complexity) break;
    // Rotate components: .yx swaps x and y (2D equivalent of .yzx in 3D)
    a += sin(a * j + vectorFieldTime).yx / j * harmonicAmp;
  }
  
  // Apply distance contribution
  vec2 distortion = a * distContrib;
  
  return distortion;
}
`,
  mainCode: `
  $output.out = $input.in;
  $output.out += vectorField($input.in) * 0.1;
`
};
