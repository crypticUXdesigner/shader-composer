import type { NodeSpec } from '../../types/nodeSpec';

export const glowBloomNodeSpec: NodeSpec = {
  id: 'glow-bloom',
  category: 'Effects',
  displayName: 'Glow',
  description:
    'WebGPU: threshold + blurred bloom passes. WebGL preview: bright-pass atop luminance; Radius boosts additive spread roughly before multipass kicks in.',
  icon: 'glow',
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
    glowThreshold: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Threshold'
    },
    glowIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Intensity'
    },
    glowRadius: {
      type: 'float',
      default: 5.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Radius'
    },
    glowStrength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Strength'
    }
  },
  functions: `
// Simplified glow effect (distance-based approximation)
float glowEffect(float value, float threshold, float intensity) {
  float bright = max(0.0, value - threshold);
  return bright * intensity;
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float glowRaw = glowEffect(lum, $param.glowThreshold, $param.glowIntensity);
  float spreadBoost = clamp(0.72 + $param.glowRadius / 220.0, 0.2, 1.8);
  float add = glowRaw * $param.glowStrength * spreadBoost;
  float blended = lum + add;
  vec3 rgb = lum > 1e-4 ? clamp(color * (blended / lum), 0.0, 1.0) : vec3(blended);
  $output.out = vec4(rgb, inColor.a);
`
};
