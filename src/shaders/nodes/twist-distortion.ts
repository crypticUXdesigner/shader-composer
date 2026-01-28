import type { NodeSpec } from '../../types';

export const twistDistortionNodeSpec: NodeSpec = {
  id: 'twist-distortion',
  category: 'Distort',
  displayName: 'Twist',
  icon: 'spiral',
  description: 'Applies rotational distortion around a center point, creating spiral/twist effects',
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
    twistCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    twistCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    twistStrength: {
      type: 'float',
      default: 2.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Strength'
    },
    twistRadius: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Radius'
    },
    twistFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    },
    twistTimeSpeed: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    twistTimeOffset: {
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
      id: 'twist-main',
      label: 'Twist Distortion',
      parameters: ['twistCenterX', 'twistCenterY', 'twistStrength', 'twistRadius', 'twistFalloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'twist-animation',
      label: 'Animation',
      parameters: ['twistTimeSpeed', 'twistTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
vec2 twist(vec2 p, vec2 center, float strength, float radius, float falloff) {
  vec2 offset = p - center;
  float dist = length(offset);
  
  // Safety check for zero distance
  if (dist < 0.001) return p;
  
  float angle = atan(offset.y, offset.x);
  
  // Apply twist based on distance
  float twistAmount = strength * (1.0 - smoothstep(0.0, max(radius, 0.001), dist)) * falloff;
  angle += twistAmount;
  
  // Reconstruct position
  return center + vec2(cos(angle), sin(angle)) * dist;
}
`,
  mainCode: `
  float twistTime = ($time + $param.twistTimeOffset) * $param.twistTimeSpeed;
  vec2 twistCenter = vec2($param.twistCenterX, $param.twistCenterY);
  float dynamicStrength = $param.twistStrength + sin(twistTime) * 0.1; // Optional: subtle animation
  $output.out = twist($input.in, twistCenter, dynamicStrength, $param.twistRadius, $param.twistFalloff);
`
};
