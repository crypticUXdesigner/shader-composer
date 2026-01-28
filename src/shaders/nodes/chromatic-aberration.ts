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
      label: 'Direction (degrees)'
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
      label: 'Chromatic Aberration',
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
// Chromatic aberration effect (simplified - approximates RGB separation)
float applyChromaticAberration(float value, vec2 p, float strength) {
  vec2 center = vec2($param.chromaticCenterX, $param.chromaticCenterY);
  vec2 dir = normalize(p - center);
  float dist = length(p - center);
  
  // Shift channels based on distance and direction
  // This is an approximation - full implementation needs texture sampling
  float rOffset = strength * dist * dir.x * 0.1;
  float bOffset = -strength * dist * dir.x * 0.1;
  
  // Approximate channel separation by modifying value
  float r = value + rOffset;
  float g = value;
  float b = value + bOffset;
  
  // Combine channels (weighted average)
  return (r * 0.3 + g * 0.4 + b * 0.3);
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Calculate screen space coordinates
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  
  // Apply chromatic aberration before color mapping
  // Note: Full chromatic aberration requires texture sampling of RGB channels
  // This is a simplified approximation
  vec2 chromaticCenter = vec2($param.chromaticCenterX, $param.chromaticCenterY);
  vec2 offset = p - chromaticCenter;
  float dist = length(offset);
  vec2 dir = dist > 0.001 ? normalize(offset) : vec2(1.0, 0.0);
  float falloff = 1.0 / max(1.0 + dist * $param.chromaticFalloff, 0.001);
  
  float rOffset = $param.chromaticStrength * dist * dir.x * 0.1 * falloff;
  float bOffset = -$param.chromaticStrength * dist * dir.x * 0.1 * falloff;
  
  // Approximate RGB separation
  float result = value + (rOffset + bOffset) * 0.1;
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
