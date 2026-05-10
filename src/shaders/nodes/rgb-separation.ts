import type { NodeSpec } from '../../types/nodeSpec';

export const rgbSeparationNodeSpec: NodeSpec = {
  id: 'rgb-separation',
  category: 'Effects',
  displayName: 'RGB Separation',
  description:
    'Screenspace glitch: biases R/G/B with separate vec2 offsets against aspect-correct coords (dot-based, not shifted UV sampling).',
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
    rgbSeparationRX: {
      type: 'float',
      default: 0.1,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Rx',
      knobPolarity: 'two-sided' },
    rgbSeparationRY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Ry',
      knobPolarity: 'two-sided' },
    rgbSeparationGX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Gx',
      knobPolarity: 'two-sided' },
    rgbSeparationGY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Gy',
      knobPolarity: 'two-sided' },
    rgbSeparationBX: {
      type: 'float',
      default: -0.1,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Bx',
      knobPolarity: 'two-sided' },
    rgbSeparationBY: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'By',
      knobPolarity: 'two-sided' },
    rgbSeparationStrength: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Strength'
    }
  },
  parameterGroups: [
    {
      id: 'rgb-separation-main',
      label: '',
      parameters: ['rgbSeparationStrength', 'rgbSeparationRX', 'rgbSeparationRY', 'rgbSeparationGX', 'rgbSeparationGY', 'rgbSeparationBX', 'rgbSeparationBY'],
      collapsible: false,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['rgbSeparationStrength', 'rgbSeparationRX', 'rgbSeparationRY', 'rgbSeparationGX', 'rgbSeparationGY', 'rgbSeparationBX', 'rgbSeparationBY'],
        parameterUI: { rgbSeparationRX: 'coords', rgbSeparationGX: 'coords', rgbSeparationBX: 'coords' },
        layout: { columns: 2, parameterSpan: { rgbSeparationStrength: 2 }, coordsSpan: 2 }
      }
    ]
  },
  functions: `
// RGB channel separation: modulate each channel by screen position so that
// red/green/blue are boosted or reduced in different directions (no texture sampling).
vec3 rgbSeparation(vec3 color, vec2 p, vec2 rOffset, vec2 gOffset, vec2 bOffset, float strength) {
  float k = 0.4 * strength;
  float rMod = 1.0 + dot(p, rOffset) * k;
  float gMod = 1.0 + dot(p, gOffset) * k;
  float bMod = 1.0 + dot(p, bOffset) * k;
  return clamp(vec3(color.r * rMod, color.g * gMod, color.b * bMod), 0.0, 1.0);
}
`,
  mainCode: `
  // Use actual RGB from input (vec3/vec4); preserve color, apply per-channel position modulation
  vec3 color = $input.in.rgb;
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  vec2 rOffset = vec2($param.rgbSeparationRX, $param.rgbSeparationRY);
  vec2 gOffset = vec2($param.rgbSeparationGX, $param.rgbSeparationGY);
  vec2 bOffset = vec2($param.rgbSeparationBX, $param.rgbSeparationBY);
  vec3 result = rgbSeparation(color, p, rOffset, gOffset, bOffset, $param.rgbSeparationStrength);
  $output.out = vec4(result, $input.in.a);
`
};
