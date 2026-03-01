import type { NodeSpec } from '../../types/nodeSpec';

export const streakNodeSpec: NodeSpec = {
  id: 'streak',
  category: 'Patterns',
  displayName: 'Streak',
  description: 'Directional streak or anamorphic overlay with angle, stretch, and intensity',
  icon: 'streak',
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
    streakAngle: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 6.28318530718,
      step: 0.01,
      label: 'Angle'
    },
    streakStretch: {
      type: 'float',
      default: 2.0,
      min: 0.2,
      max: 10.0,
      step: 0.1,
      label: 'Stretch'
    },
    streakWidth: {
      type: 'float',
      default: 0.15,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: 'Width'
    },
    streakIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'streak',
      label: 'Streak',
      parameters: ['streakAngle', 'streakStretch', 'streakWidth'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'output',
      label: 'Output',
      parameters: ['streakIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  mainCode: `
  float angle = $param.streakAngle;
  vec2 axis = vec2(cos(angle), sin(angle));
  vec2 perpAxis = vec2(-sin(angle), cos(angle));
  vec2 p = $input.in;
  float along = dot(p, axis);
  float perp = dot(p, perpAxis);
  float width = max($param.streakWidth, 0.01);
  float stretch = max($param.streakStretch, 0.2);
  float falloff = exp(-(perp * perp) / (width * width));
  float alongFalloff = 1.0 - smoothstep(0.0, stretch, abs(along));
  float v = falloff * alongFalloff * $param.streakIntensity;
  $output.out += v;
`
};
