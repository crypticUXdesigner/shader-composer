import type { NodeSpec } from '../../types/nodeSpec';

export const normalMappingNodeSpec: NodeSpec = {
  id: 'normal-mapping',
  category: 'Effects',
  displayName: 'Normal Mapping',
  description:
    'Pseudo-bump shading in screenspace from input luminance (no height texture sampling)—Scale/Strength carve a dome-like normal.',
  icon: 'normal-map',
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
    normalScale: {
      type: 'float',
      default: 5.0,
      min: 0.1,
      max: 20.0,
      step: 0.1,
      label: 'Scale'
    },
    normalStrength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Strength'
    },
    normalLightX: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'X',
      knobPolarity: 'two-sided' },
    normalLightY: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Y',
      knobPolarity: 'two-sided' },
    normalLightZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Z',
      knobPolarity: 'two-sided' }
  },
  parameterGroups: [
    {
      id: 'normal-main',
      label: 'Normal Mapping',
      parameters: ['normalScale', 'normalStrength'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'normal-lighting',
      label: 'Lighting',
      parameters: ['normalLightX', 'normalLightY', 'normalLightZ'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['normalScale', 'normalStrength'],
        layout: { columns: 3, parameterSpan: { normalStrength: 2 } }
      },
      {
        type: 'grid',
        label: 'Lighting',
        parameters: ['normalLightX', 'normalLightY', 'normalLightZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// Screenspace bumps: perturb Z by sampled luminance (no derivative neighbor samples).
vec3 calculateNormal(vec2 p, float scale, float luminanceAmt) {
  float amp = (0.12 + luminanceAmt) * scale;
  return normalize(vec3(-p.x * amp, -p.y * amp, 1.0));
}

// Apply normal mapping to result
float applyNormalMapping(float baseValue, vec3 normal, vec3 lightDir) {
  float lightLen = length(lightDir);
  vec3 lightNorm = lightLen > 0.001 ? normalize(lightDir) : vec3(0.0, 0.0, 1.0);
  float lighting = max(dot(normal, lightNorm), 0.0);
  return baseValue * (0.5 + 0.5 * lighting);
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  vec3 lightDir = normalize(vec3($param.normalLightX, $param.normalLightY, $param.normalLightZ));
  vec3 normal = calculateNormal(p * $param.normalScale, $param.normalScale, lum);
  float normalEffect = applyNormalMapping(lum, normal, lightDir);
  float mixedLum = mix(lum, normalEffect, clamp($param.normalStrength, 0.0, 1.0));
  vec3 resultRgb =
    lum > 1e-4 ? clamp(color * (mixedLum / lum), 0.0, 1.0) : vec3(mixedLum);

  $output.out = vec4(resultRgb, inColor.a);
`
};
