import type { NodeSpec } from '../../types/nodeSpec';

export const lightingShadingNodeSpec: NodeSpec = {
  id: 'lighting-shading',
  category: 'Effects',
  displayName: 'Lighting',
  description:
    'Screenspace shading on input luminance: Directional fake-normal from XY; Point light attenuates distance only (angle-free). Tint multiplies preserved RGB.',  icon: 'light',
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
      label: 'Shading'
    }
  ],
  parameters: {
    lightType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Type'
    },
    lightDirX: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'X',
      knobPolarity: 'two-sided' },
    lightDirY: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Y',
      knobPolarity: 'two-sided' },
    lightDirZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Z',
      knobPolarity: 'two-sided' },
    lightPosX: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'X',
      knobPolarity: 'two-sided' },
    lightPosY: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Y',
      knobPolarity: 'two-sided' },
    lightPosZ: {
      type: 'float',
      default: 3.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos. Z',
      knobPolarity: 'two-sided' },
    lightIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    lightAmbient: {
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Ambient'
    },
    lightFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    },
    lightColorR: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.001,
      label: 'R'
    },
    lightColorG: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.001,
      label: 'G'
    },
    lightColorB: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.001,
      label: 'B'
    }
  },
  parameterGroups: [
    {
      id: 'light-main',
      label: 'Lighting',
      parameters: ['lightType', 'lightIntensity', 'lightAmbient'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'light-directional',
      label: 'Directional',
      parameters: ['lightDirX', 'lightDirY', 'lightDirZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'light-point',
      label: 'Point',
      parameters: ['lightPosX', 'lightPosY', 'lightPosZ', 'lightFalloff'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'light-color',
      label: 'Color',
      parameters: ['lightColorR', 'lightColorG', 'lightColorB'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    minColumns: 3,
    elements: [
      {
        type: 'grid',
        parameters: ['lightType', 'lightAmbient', 'lightIntensity'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Directional',
        parameters: ['lightDirX', 'lightDirY', 'lightDirZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Point',
        parameters: ['lightPosX', 'lightPosY', 'lightPosZ', 'lightFalloff'],
        layout: { columns: 3, parameterSpan: { lightFalloff: 3 } }
      },
      {
        type: 'grid',
        label: 'Color',
        parameters: ['lightColorR', 'lightColorG', 'lightColorB'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// Directional light
float directionalLight(vec3 normal, vec3 lightDir) {
  return max(dot(normal, normalize(lightDir)), 0.0);
}

// Point light
float pointLight(vec3 p, vec3 lightPos, float intensity, float falloff) {
  vec3 toLight = lightPos - p;
  float dist = length(toLight);
  float attenuation = intensity / max(1.0 + falloff * dist * dist, 0.001);
  return attenuation;
}

// Calculate surface normal from gradient (simplified)
vec3 surfaceNormal(vec2 p) {
  // Approximate normal from result value
  // In full implementation, would sample neighboring pixels
  vec3 normal = vec3(0.0, 0.0, 1.0);
  
  // Simple approximation based on position
  float gradient = length(p) * 0.1;
  normal = normalize(vec3(p.x * gradient, p.y * gradient, 1.0));
  
  return normal;
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  float lightingTerm = 0.0;

  if ($param.lightType == 0) {
    vec3 normal = surfaceNormal(p);
    vec3 lightDirVec = vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ);
    float lightLen = length(lightDirVec);
    vec3 lightDir = lightLen > 0.001 ? normalize(lightDirVec) : vec3(0.0, 0.0, 1.0);
    lightingTerm = directionalLight(normal, lightDir);
  } else if ($param.lightType == 1) {
    vec3 lightPos = vec3($param.lightPosX, $param.lightPosY, $param.lightPosZ);
    lightingTerm = pointLight(vec3(p, 0.0), lightPos, $param.lightIntensity, $param.lightFalloff);
  }

  vec3 lightColor = vec3($param.lightColorR, $param.lightColorG, $param.lightColorB);
  float shadedLum = lum * ($param.lightAmbient + lightingTerm * $param.lightIntensity);
  vec3 resultRgb =
    lum > 1e-4 ? clamp(lightColor * color * (shadedLum / lum), 0.0, 1.0) : shadedLum * lightColor;

  $output.out = vec4(resultRgb, inColor.a);
`
};
