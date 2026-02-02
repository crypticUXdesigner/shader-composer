import type { NodeSpec } from '../../types';

export const stripesNodeSpec: NodeSpec = {
  id: 'stripes',
  category: 'Patterns',
  displayName: 'Stripes',
  description: 'Directional alternating bands with configurable angle, frequency, and sharp or soft edges',
  icon: 'grid',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float'
    }
  ],
  parameters: {
    stripesAngle: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Angle'
    },
    stripesFrequency: {
      type: 'float',
      default: 5.0,
      min: 0.1,
      max: 50.0,
      step: 0.1,
      label: 'Frequency'
    },
    stripesSharpness: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Sharpness'
    },
    stripesIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    stripesPhase: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 6.28,
      step: 0.05,
      label: 'Phase'
    },
    stripesTimeSpeed: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    }
  },
  parameterGroups: [
    {
      id: 'stripes-main',
      label: 'Stripes',
      parameters: ['stripesAngle', 'stripesFrequency', 'stripesSharpness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'stripes-output',
      label: 'Output',
      parameters: ['stripesIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'stripes-animation',
      label: 'Animation',
      parameters: ['stripesPhase', 'stripesTimeSpeed'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
vec2 stripesRotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}
`,
  mainCode: `
  float stripePhase = $param.stripesPhase + $time * $param.stripesTimeSpeed;
  float angleRad = $param.stripesAngle * 3.14159 / 180.0;
  vec2 p = stripesRotate($input.in, angleRad);
  float x = p.x * $param.stripesFrequency + stripePhase;
  float t = fract(x);
  float stripe;
  if ($param.stripesSharpness < 0.001) {
    stripe = smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(0.5, 1.0, t));
    stripe = stripe * 2.0;
  } else if ($param.stripesSharpness > 0.999) {
    stripe = step(0.5, t);
  } else {
    float edge = 0.5 * (1.0 - $param.stripesSharpness);
    stripe = smoothstep(0.5 - edge, 0.5 + edge, t);
  }
  $output.out += stripe * $param.stripesIntensity;
`
};
