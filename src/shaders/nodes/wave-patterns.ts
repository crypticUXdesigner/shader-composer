import type { NodeSpec } from '../../types/nodeSpec';

export const wavePatternsNodeSpec: NodeSpec = {
  id: 'wave-patterns',
  category: 'Patterns',
  displayName: 'Wave Patterns',
  description: 'Linear wave patterns (sine, cosine, square, triangle) that complement rings',
  icon: 'wave-sine',
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
      label: 'Value'
    }
  ],
  parameters: {
    waveScale: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Scale'
    },
    waveFrequency: {
      type: 'float',
      default: 5.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Frequency'
    },
    waveAmplitude: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Amplitude'
    },
    waveType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 3,
      step: 1,
      label: 'Wave Type'
    },
    waveDirection: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Direction'
    },
    wavePhaseSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 10.0,
      step: 0.01,
      label: 'Phase Speed'
    },
    wavePhaseOffset: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 6.28,
      step: 0.05,
      label: 'Phase Offset'
    },
    waveTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    waveIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    waveTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    }
  },
  parameterGroups: [
    {
      id: 'wave-main',
      label: 'Wave Pattern',
      parameters: ['waveScale', 'waveFrequency', 'waveAmplitude', 'waveType', 'waveDirection', 'waveIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'wave-animation',
      label: 'Animation',
      parameters: ['wavePhaseSpeed', 'wavePhaseOffset', 'waveTimeSpeed', 'waveTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['waveScale', 'waveFrequency', 'waveAmplitude', 'waveType', 'waveDirection', 'waveIntensity'],
        layout: { columns: 'auto' }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['wavePhaseSpeed', 'wavePhaseOffset', 'waveTimeSpeed', 'waveTimeOffset'],
        layout: { columns: 3, parameterSpan: { wavePhaseOffset: 2, waveTimeOffset: 2 } }
      }
    ]
  },
  functions: `
float wavePattern(vec2 p, float frequency, float amplitude, float phase, int waveType) {
  float value = 0.0;
  
  if (waveType == 0) {
    // Sine wave
    value = sin(p.x * frequency + phase) * amplitude;
  } else if (waveType == 1) {
    // Cosine wave
    value = cos(p.x * frequency + phase) * amplitude;
  } else if (waveType == 2) {
    // Square wave
    value = sign(sin(p.x * frequency + phase)) * amplitude;
  } else if (waveType == 3) {
    // Triangle wave
    value = abs(mod(p.x * frequency + phase, 2.0) - 1.0) * amplitude * 2.0 - amplitude;
  }
  
  return value * 0.5 + 0.5; // Normalize to 0-1
}

// Rotate point
vec2 rotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}
`,
  mainCode: `
  float waveTime = ($time + $param.waveTimeOffset) * $param.waveTimeSpeed;
  float wavePhase = waveTime * $param.wavePhaseSpeed + $param.wavePhaseOffset;
  
  // Rotate coordinates based on direction
  vec2 waveRotatedP = rotate($input.in, $param.waveDirection * 3.14159 / 180.0);
  
  float waveVal = wavePattern(
    waveRotatedP * $param.waveScale,
    $param.waveFrequency,
    $param.waveAmplitude,
    wavePhase,
    $param.waveType
  );
  $output.out += waveVal * $param.waveIntensity;
`
};
