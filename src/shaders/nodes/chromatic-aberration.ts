import type { NodeSpec } from '../../types';

export const chromaticAberrationNodeSpec: NodeSpec = {
  id: 'chromatic-aberration',
  category: 'Effects',
  displayName: 'Chromatic Aberration',
  description: 'Separates RGB channels to create stylized color fringing effects',
  icon: 'rgb-split',
  inputs: [
    {
      name: 'in',
      type: 'vec4'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4'
    }
  ],
  parameters: {
    chromaticStrength: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Strength'
    },
    chromaticDirection: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Direction'
    },
    chromaticCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    chromaticCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    chromaticFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    }
  },
  parameterGroups: [
    {
      id: 'chromatic-main',
      label: 'Chromatic',
      parameters: ['chromaticStrength', 'chromaticDirection'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'chromatic-center',
      label: 'Center',
      parameters: ['chromaticCenterX', 'chromaticCenterY', 'chromaticFalloff'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
// Chromatic aberration: modulate R/G/B by screen position (radial from center).
// Full lens-style fringing would need texture sampling at offset UVs.
vec3 applyChromaticAberration(vec3 color, vec2 p, vec2 center, float strength, float falloff) {
  vec2 offset = p - center;
  float dist = length(offset);
  vec2 dir = dist > 0.001 ? normalize(offset) : vec2(1.0, 0.0);
  float f = 1.0 / max(1.0 + dist * falloff, 0.001);
  float k = strength * dist * 0.55 * f;
  float rMod = 1.0 + dir.x * k;
  float gMod = 1.0;
  float bMod = 1.0 - dir.x * k;
  return clamp(vec3(color.r * rMod, color.g * gMod, color.b * bMod), 0.0, 1.0);
}
`,
  mainCode: `
  vec3 color = $input.in.rgb;
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  vec2 center = vec2($param.chromaticCenterX, $param.chromaticCenterY);
  vec3 result = applyChromaticAberration(color, p, center, $param.chromaticStrength, $param.chromaticFalloff);
  $output.out = vec4(result, 1.0);
`
};
