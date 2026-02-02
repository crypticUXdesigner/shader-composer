import type { NodeSpec } from '../../types';

export const sunbeamsNodeSpec: NodeSpec = {
  id: 'sunbeams',
  category: 'Patterns',
  displayName: 'Sunbeams',
  description: 'Directional beams at an angle; count, spread, width, and softness',
  icon: 'glow',
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
    angle: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Angle'
    },
    spread: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Spread'
    },
    beamCount: {
      type: 'int',
      default: 8,
      min: 1,
      max: 32,
      step: 1,
      label: 'Beam Count'
    },
    width: {
      type: 'float',
      default: 0.08,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: 'Width'
    },
    softness: {
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Softness'
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
      id: 'sunbeams-beams',
      label: 'Beams',
      parameters: ['angle', 'spread', 'beamCount', 'width'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'sunbeams-appearance',
      label: 'Appearance',
      parameters: ['softness', 'intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float sunbeams(vec2 p, float angleDeg, float spread, int beamCount, float width, float softness) {
  float angleRad = angleDeg * 0.017453292519943295;
  vec2 dir = vec2(cos(angleRad), sin(angleRad));
  vec2 perp = vec2(-dir.y, dir.x);
  float along = dot(p, perp) * spread;
  float t = fract(along * float(beamCount));
  float distFromCenter = min(t, 1.0 - t) * 2.0;
  float beam = 1.0 - smoothstep(width, width + softness, distFromCenter);
  return beam;
}
`,
  mainCode: `
  float beam = sunbeams($input.in, $param.angle, $param.spread, $param.beamCount, $param.width, $param.softness);
  $output.out += beam * $param.intensity;
`
};
