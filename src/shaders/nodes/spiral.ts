import type { NodeSpec } from '../../types';

export const spiralNodeSpec: NodeSpec = {
  id: 'spiral',
  category: 'Patterns',
  displayName: 'Spiral',
  description: 'Spiral pattern with configurable density, rotation, arms, and thickness',
  icon: 'spiral',
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
    spiralCenterX: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    spiralCenterY: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    spiralDensity: {
      type: 'float',
      default: 4.0,
      min: 0.5,
      max: 20.0,
      step: 0.5,
      label: 'Density'
    },
    spiralRotation: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Rotation'
    },
    spiralArms: {
      type: 'float',
      default: 1.0,
      min: 0.5,
      max: 16.0,
      step: 0.5,
      label: 'Arms'
    },
    spiralThickness: {
      type: 'float',
      default: 0.15,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: 'Thickness'
    },
    spiralIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    spiralTimePhase: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Time Phase'
    }
  },
  parameterGroups: [
    {
      id: 'spiral-main',
      label: 'Spiral',
      parameters: ['spiralCenterX', 'spiralCenterY', 'spiralDensity', 'spiralRotation', 'spiralArms'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'spiral-appearance',
      label: 'Appearance',
      parameters: ['spiralThickness', 'spiralIntensity', 'spiralTimePhase'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float spiralPattern(vec2 p, vec2 center, float density, float rotation, float arms, float thickness) {
  vec2 offset = p - center;
  float angle = atan(offset.y, offset.x);
  float radius = length(offset);
  float phase = angle + density * radius + ($time + $param.spiralTimePhase) * 2.0;
  float armPhase = fract(phase / (6.28318530718 / arms));
  float band = smoothstep(0.0, thickness, armPhase) * smoothstep(1.0, 1.0 - thickness, armPhase);
  return band;
}
`,
  mainCode: `
  vec2 spiralCenter = vec2($param.spiralCenterX, $param.spiralCenterY);
  float band = spiralPattern($input.in, spiralCenter, $param.spiralDensity, $param.spiralRotation, $param.spiralArms, $param.spiralThickness);
  $output.out += band * $param.spiralIntensity;
`
};
