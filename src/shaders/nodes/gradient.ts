import type { NodeSpec } from '../../types';

export const gradientNodeSpec: NodeSpec = {
  id: 'gradient',
  category: 'Patterns',
  displayName: 'Gradient',
  description: 'Radial or linear gradient pattern (float 0–1) for vignettes, orbs, and fades',
  icon: 'gradient',
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
    gradientType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Type'
    },
    centerX: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    centerY: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    radius: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Radius'
    },
    falloff: {
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Falloff'
    },
    angle: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Angle'
    },
    linearScale: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Scale'
    },
    intensity: {
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
      id: 'gradient-type',
      label: 'Type',
      parameters: ['gradientType'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'gradient-radial',
      label: 'Radial',
      parameters: ['centerX', 'centerY', 'radius', 'falloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'gradient-linear',
      label: 'Linear',
      parameters: ['angle', 'linearScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'gradient-output',
      label: 'Output',
      parameters: ['intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float gradientRadial(vec2 p, vec2 center, float radius, float falloff) {
  float d = length(p - center);
  float edge0 = max(0.0, radius - falloff);
  float edge1 = radius;
  return 1.0 - smoothstep(edge0, edge1, d);
}

float gradientLinear(vec2 p, float angleDeg, float scale) {
  float angleRad = angleDeg * 0.017453292519943295; // degrees to radians
  vec2 dir = vec2(cos(angleRad), sin(angleRad));
  float t = dot(p, dir) * scale + 0.5;
  return clamp(t, 0.0, 1.0);
}
`,
  mainCode: `
  vec2 p = $input.in;
  float g = 0.0;
  if ($param.gradientType == 0) {
    vec2 center = vec2($param.centerX, $param.centerY);
    g = gradientRadial(p, center, $param.radius, $param.falloff);
  } else {
    g = gradientLinear(p, $param.angle, $param.linearScale);
  }
  $output.out += g * $param.intensity;
`
};
