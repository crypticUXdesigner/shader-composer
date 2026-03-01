import type { NodeSpec } from '../../types/nodeSpec';

export const twistDistortionNodeSpec: NodeSpec = {
  id: 'twist-distortion',
  category: 'Distort',
  displayName: 'Twist',
  icon: 'spiral',
  description: 'Applies rotational distortion around a center point, creating spiral/twist effects',
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
      label: 'Speed'
    },
    twistTimeOffset: {
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
      id: 'twist-main',
      label: 'Twist',
      parameters: ['twistStrength', 'twistCenterX', 'twistCenterY', 'twistRadius', 'twistFalloff'],
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
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['twistStrength', 'twistCenterX', 'twistCenterY', 'twistRadius', 'twistFalloff'],
        parameterUI: { twistCenterX: 'coords', twistCenterY: 'coords' },
        layout: { columns: 3, coordsSpan: 2, parameterSpan: { twistFalloff: 2 } }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['twistTimeSpeed', 'twistTimeOffset']
      }
    ]
  },
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
  float twistTime = $time * $param.twistTimeSpeed + $param.twistTimeOffset;
  vec2 twistCenter = vec2($param.twistCenterX, $param.twistCenterY);
  float dynamicStrength = $param.twistStrength + sin(twistTime) * 0.1; // Optional: subtle animation
  $output.out = twist($input.in, twistCenter, dynamicStrength, $param.twistRadius, $param.twistFalloff);
`
};
