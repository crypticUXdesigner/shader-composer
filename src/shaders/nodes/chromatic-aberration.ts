import type { NodeSpec } from '../../types/nodeSpec';

export const chromaticAberrationNodeSpec: NodeSpec = {
  id: 'chromatic-aberration',
  category: 'Effects',
  displayName: 'Chromatic Aberration',
  description:
    'Radial RGB fringing toward a screen center—Direction spins the fringe axis (degrees). Screenspace modulation, no texture resampling.',
  icon: 'rgb-split',
  inputs: [
    {
      name: 'in',
      type: 'vec4',
      label: 'Color'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4',
      label: 'Color'
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
      label: 'Center X',
      knobPolarity: 'two-sided' },
    chromaticCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y',
      knobPolarity: 'two-sided' },
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
      label: 'Fringe',
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
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['chromaticDirection', 'chromaticFalloff', 'chromaticCenterX', 'chromaticCenterY', 'chromaticStrength'],
        parameterUI: { chromaticCenterX: 'coords', chromaticCenterY: 'coords' },
        layout: { columns: 2, coordsSpan: 2, parameterSpan: { chromaticStrength: 2 } }
      }
    ]
  },
  functions: `
// Chromatic aberration: modulate R/G/B by screen position (radial from center).
// Full lens-style fringing would need texture sampling at offset UVs.
vec3 applyChromaticAberration(vec3 color, vec2 p, vec2 center, float strength, float falloff, float directionDeg) {
  vec2 offset = p - center;
  float dist = length(offset);
  vec2 dir = dist > 0.001 ? normalize(offset) : vec2(1.0, 0.0);
  float rad = radians(directionDeg);
  vec2 sepAxis = vec2(cos(rad), sin(rad));
  float sep = dot(dir, sepAxis);
  float f = 1.0 / max(1.0 + dist * falloff, 0.001);
  float k = strength * dist * 0.55 * f;
  float rMod = 1.0 + sep * k;
  float gMod = 1.0;
  float bMod = 1.0 - sep * k;
  return clamp(vec3(color.r * rMod, color.g * gMod, color.b * bMod), 0.0, 1.0);
}
`,
  mainCode: `
  vec3 color = $input.in.rgb;
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  vec2 center = vec2($param.chromaticCenterX, $param.chromaticCenterY);
  vec3 result = applyChromaticAberration(color, p, center, $param.chromaticStrength, $param.chromaticFalloff, $param.chromaticDirection);
  $output.out = vec4(result, $input.in.a);
`
};
