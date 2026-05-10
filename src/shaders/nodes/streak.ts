import type { NodeSpec } from '../../types/nodeSpec';

export const streakNodeSpec: NodeSpec = {
  id: 'streak',
  category: 'Patterns',
  displayName: 'Spot',
  description:
    'Elongated directional spot on UVs: angle in degrees (+X/+Y align with Stripes), width across the ridge, fade length along it',
  icon: 'circle-half-tilt',
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
    streakAngleDeg: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Angle'
    },
    streakStretch: {
      type: 'float',
      default: 2.0,
      min: 0.2,
      max: 10.0,
      step: 0.1,
      label: 'Along length'
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
      id: 'spot-main',
      label: 'Spot',
      parameters: ['streakAngleDeg', 'streakStretch', 'streakWidth', 'streakIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  mainCode: `
  float angle = $param.streakAngleDeg * 0.017453292519943295;
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
