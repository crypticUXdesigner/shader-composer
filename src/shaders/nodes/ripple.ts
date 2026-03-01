import type { NodeSpec } from '../../types/nodeSpec';

export const rippleNodeSpec: NodeSpec = {
  id: 'ripple',
  category: 'Distort',
  displayName: 'Ripple',
  icon: 'wave-sine',
  description: 'Sine-wave displacement; concentric rings or directional bands for water/glass effects',
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
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {
    rippleCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X',
      inputMode: 'add'
    },
    rippleCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y',
      inputMode: 'add'
    },
    rippleMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Mode'
    },
    rippleFrequency: {
      type: 'float',
      default: 8.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Frequency'
    },
    rippleAmplitude: {
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 0.5,
      step: 0.005,
      label: 'Amplitude'
    },
    ripplePhase: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Phase'
    },
    rippleTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Speed'
    },
    rippleTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Offset',
      inputMode: 'add'
    }
  },
  parameterGroups: [
    {
      id: 'ripple-main',
      label: 'Ripple',
      parameters: ['rippleMode', 'rippleCenterX', 'rippleCenterY', 'rippleFrequency', 'rippleAmplitude', 'ripplePhase'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'ripple-animation',
      label: 'Animation',
      parameters: ['rippleTimeSpeed', 'rippleTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['rippleMode', 'rippleCenterX', 'rippleCenterY', 'rippleFrequency', 'rippleAmplitude', 'ripplePhase'],
        parameterUI: { rippleCenterX: 'coords', rippleCenterY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['rippleTimeSpeed', 'rippleTimeOffset']
      }
    ]
  },
  functions: `
vec2 ripple(vec2 p, vec2 center, int mode, float freq, float amp, float phase, float time) {
  vec2 d = p - center;
  float dist = length(d);
  vec2 n = dist > 0.0001 ? normalize(d) : vec2(1.0, 0.0);
  float t = phase + time;
  float wave;
  if (mode == 0) {
    wave = sin(dist * freq + t);
    return p + n * (wave * amp);
  } else {
    float dx = amp * sin(p.y * freq + t);
    float dy = amp * sin(p.x * freq + t * 0.7);
    return p + vec2(dx, dy);
  }
}
`,
  mainCode: `
  vec2 rippleCenter = vec2($param.rippleCenterX, $param.rippleCenterY);
  float rippleTime = $time * $param.rippleTimeSpeed + $param.rippleTimeOffset;
  $output.out = ripple($input.in, rippleCenter, $param.rippleMode, $param.rippleFrequency, $param.rippleAmplitude, $param.ripplePhase, rippleTime);
`
};
