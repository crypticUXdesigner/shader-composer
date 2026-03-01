import type { NodeSpec } from '../../types/nodeSpec';

export const sphereRaymarchNodeSpec: NodeSpec = {
  id: 'sphere-raymarch',
  category: 'Shapes',
  displayName: 'Raymarch Sphere',
  description: '3D sphere rendered using raymarching technique with vector field distortion and glow effects',
  icon: 'sphere',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Glow'
    }
  ],
  parameters: {
    sphereRadius: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      label: 'Radius',
      inputMode: 'override'
    },
    sphereGlowIntensity: {
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Glow',
      inputMode: 'override'
    },
    sphereBrightness: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: 'Brightness'
    },
    raymarchSteps: {
      type: 'int',
      default: 30.0,
      min: 20.0,
      max: 200.0,
      step: 1.0,
      label: 'Raymarch'
    },
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
      id: 'sphere',
      label: 'Sphere',
      parameters: ['sphereRadius', 'sphereBrightness', 'sphereGlowIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'vector-field-shape',
      label: 'Vector Field',
      parameters: [
        'vectorFieldFrequencyX',
        'vectorFieldFrequencyY',
        'vectorFieldFrequencyZ',
        'vectorFieldAmplitude',
        'vectorFieldRadialStrength',
        'vectorFieldHarmonicAmplitude',
        'vectorFieldComplexity',
        'vectorFieldDistanceContribution',
        'raymarchSteps'
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
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['sphereRadius', 'sphereBrightness', 'sphereGlowIntensity'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Vector Field',
        parameters: [
          'vectorFieldFrequencyX',
          'vectorFieldFrequencyY',
          'vectorFieldFrequencyZ',
          'vectorFieldAmplitude',
          'vectorFieldRadialStrength',
          'vectorFieldHarmonicAmplitude',
          'vectorFieldComplexity',
          'vectorFieldDistanceContribution',
          'raymarchSteps'
        ],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['vectorFieldSpeed', 'animationSpeed'],
        layout: { columns: 2 }
      }
    ]
  },
  mainCode: `
  // Use app's coordinate system (p is normalized screen space from base shader)
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3($input.in, -1.0));
  
  // Vector field speed
  float vectorFieldSpeed = $param.vectorFieldSpeed;
  float vectorFieldTime = $time * $param.animationSpeed * vectorFieldSpeed;
  
  // Sphere radius in normalized coordinate space
  float sphereRadius = $param.sphereRadius;
  
  vec4 o = vec4(0.0);
  
  // Use mediump for intermediate raymarch calculations
  mediump float z = 0.0;
  mediump float d = 1.0;
  
  // Pre-calculate all uniform-dependent values outside the loop
  mediump vec3 frequencies = vec3($param.vectorFieldFrequencyX, $param.vectorFieldFrequencyY, $param.vectorFieldFrequencyZ);
  float radialStrength = $param.vectorFieldRadialStrength;
  float amplitude = $param.vectorFieldAmplitude;
  float complexity = clamp($param.vectorFieldComplexity, 1.0, 15.0);
  float harmonicAmp = $param.vectorFieldHarmonicAmplitude;
  float distContrib = $param.vectorFieldDistanceContribution;
  
  // Apply glow intensity and brightness
  float glowMultiplier = $param.sphereGlowIntensity * $param.sphereBrightness;
  
  // Calculate raymarch steps
  float maxSteps = float($param.raymarchSteps);
  maxSteps = clamp(maxSteps, 20.0, 200.0);
  
  // Use constant maximum for loop bound (GLSL requirement)
  for(float i = 0.0; i < 200.0; i++) {
    // Early break if we've reached the desired step count
    if (i >= maxSteps) break;
    
    // Calculate position along ray
    mediump vec3 pos = ro + z * rd;
    
    // Vector field calculation (adapted from reference)
    mediump vec3 a = normalize(cos(frequencies + vectorFieldTime - d * radialStrength));
    pos.z += 0.5; // Adjusted for normalized coordinate space
    
    a = a * dot(a, pos) - cross(a, pos) * amplitude;
    
    // Harmonic layers
    for(float j = 1.0; j < 15.0; j++) {
      if (j >= complexity) break;
      a += sin(a * j + vectorFieldTime).yzx / j * harmonicAmp;
    }
    
    // Distance to sphere with vector field distortion
    mediump float pLen = length(pos);
    d = 0.05 * abs(pLen - sphereRadius) + distContrib * abs(a.y);
    
    // Accumulate glow (fix: use max(z, 0.01) to avoid zero on first iteration)
    o += (cos(d / 0.1 + vec4(0.0, 2.0, 4.0, 0.0)) + 1.0) / d * max(z, 0.01) * glowMultiplier;
    z += d;
    
    // Early exit if we've gone too far
    if (z > 100.0) break;
  }
  
  // Normalize accumulated value to 0-1 range
  // Use a more appropriate divisor based on typical accumulated glow values
  // Typical values range from tens to low hundreds, so 100-200 is more appropriate than 10000
  // Adjust normalization based on glow multiplier to prevent overflow
  float accumulatedGlow = length(o.rgb);
  float normalizationDivisor = 200.0 / max(glowMultiplier, 0.1);
  float normalizedValue = clamp(accumulatedGlow / normalizationDivisor, 0.0, 1.0);
  $output.out += normalizedValue;
`
};
