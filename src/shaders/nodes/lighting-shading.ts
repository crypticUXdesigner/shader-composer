import type { NodeSpec } from '../../types/nodeSpec';

export const lightingShadingNodeSpec: NodeSpec = {
  id: 'lighting-shading',
  category: 'Effects',
  displayName: 'Lighting',
  description: 'Adds directional or point lighting to create depth and dimension',
  icon: 'light',
  inputs: [
    {
      name: 'in',
      type: 'vec4',
      label: 'Luminance'
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
      label: 'X'
    },
    lightDirY: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Y'
    },
    lightDirZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Z'
    },
    lightPosX: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'X'
    },
    lightPosY: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Y'
    },
    lightPosZ: {
      type: 'float',
      default: 3.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos. Z'
    },
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
      step: 0.01,
      label: 'R'
    },
    lightColorG: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'G'
    },
    lightColorB: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
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
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Calculate screen space coordinates
  vec2 p = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  
  // Calculate lighting
  float lighting = 0.0;
  vec3 lightColor = vec3($param.lightColorR, $param.lightColorG, $param.lightColorB);
  
  if ($param.lightType == 0) {
    // Directional
    vec3 normal = surfaceNormal(p);
    vec3 lightDirVec = vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ);
    float lightLen = length(lightDirVec);
    vec3 lightDir = lightLen > 0.001 ? normalize(lightDirVec) : vec3(0.0, 0.0, 1.0);
    lighting = directionalLight(normal, lightDir);
  } else if ($param.lightType == 1) {
    // Point light
    vec3 lightPos = vec3($param.lightPosX, $param.lightPosY, $param.lightPosZ);
    lighting = pointLight(vec3(p, 0.0), lightPos, $param.lightIntensity, $param.lightFalloff);
  }
  
  // Apply lighting to result
  float result = value * ($param.lightAmbient + lighting * $param.lightIntensity);
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
