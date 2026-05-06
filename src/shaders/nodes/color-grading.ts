import type { NodeSpec } from '../../types/nodeSpec';

export const colorGradingNodeSpec: NodeSpec = {
  id: 'color-grading',
  category: 'Effects',
  displayName: 'Color Grading',
  description: 'Provides fine control over color curves (shadows, midtones, highlights) for final color adjustment',
  icon: 'color-palette',
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
    colorShadowsR: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'R'
    },
    colorShadowsG: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'G'
    },
    colorShadowsB: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'B'
    },
    colorMidtonesR: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'R'
    },
    colorMidtonesG: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'G'
    },
    colorMidtonesB: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'B'
    },
    colorHighlightsR: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'R'
    },
    colorHighlightsG: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'G'
    },
    colorHighlightsB: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'B'
    },
    levelsInMin: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'In Black'
    },
    levelsInMax: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'In White'
    },
    levelsOutMin: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Out Black'
    },
    levelsOutMax: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Out White'
    },
    levelsGamma: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.01,
      label: 'Gamma'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['levelsInMax', 'levelsOutMax', 'levelsInMin', 'levelsOutMin', 'levelsGamma'],
        layout: {
          columns: 3,
          parameterSpan: { levelsOutMax: 2, levelsOutMin: 2, levelsGamma: 3 }
        }
      },
      {
        type: 'grid',
        label: 'Shadows',
        parameters: ['colorShadowsR', 'colorShadowsG', 'colorShadowsB'],
        layout: { columns: 'auto' }
      },
      {
        type: 'grid',
        label: 'Midtones',
        parameters: ['colorMidtonesR', 'colorMidtonesG', 'colorMidtonesB'],
        layout: { columns: 'auto' }
      },
      {
        type: 'grid',
        label: 'Highlights',
        parameters: ['colorHighlightsR', 'colorHighlightsG', 'colorHighlightsB'],
        layout: { columns: 'auto' }
      }
    ]
  },
  parameterGroups: [
    {
      id: 'color-levels',
      label: '',
      parameters: ['levelsInMin', 'levelsInMax', 'levelsOutMin', 'levelsOutMax', 'levelsGamma'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'color-shadows',
      label: 'Shadows',
      parameters: ['colorShadowsR', 'colorShadowsG', 'colorShadowsB'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'color-midtones',
      label: 'Midtones',
      parameters: ['colorMidtonesR', 'colorMidtonesG', 'colorMidtonesB'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'color-highlights',
      label: 'Highlights',
      parameters: ['colorHighlightsR', 'colorHighlightsG', 'colorHighlightsB'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float _safeDenom(float x) {
  return abs(x) < 1e-6 ? (x < 0.0 ? -1e-6 : 1e-6) : x;
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Color curve adjustment (shadows/midtones/highlights) using luminance masks.
vec3 applyColorCurve(vec3 color, vec3 shadows, vec3 midtones, vec3 highlights) {
  float lum = luminance(color);
  vec3 adjusted = color;
  
  // Shadows (dark areas)
  float shadowMask = 1.0 - smoothstep(0.0, 0.33, lum);
  adjusted = mix(adjusted, adjusted * shadows, shadowMask);
  
  // Midtones
  float midtoneMask = smoothstep(0.0, 0.33, lum) * (1.0 - smoothstep(0.33, 0.66, lum));
  adjusted = mix(adjusted, adjusted * midtones, midtoneMask);
  
  // Highlights (bright areas)
  float highlightMask = smoothstep(0.33, 1.0, lum);
  adjusted = mix(adjusted, adjusted * highlights, highlightMask);
  
  return adjusted;
}

// Levels adjustment
float applyLevels(float value, float inMin, float inMax, float outMin, float outMax, float gamma) {
  value = clamp((value - inMin) / _safeDenom(inMax - inMin), 0.0, 1.0);
  value = pow(value, 1.0 / max(gamma, 1e-6));
  value = value * (outMax - outMin) + outMin;
  return value;
}

vec3 applyLevels(vec3 color, float inMin, float inMax, float outMin, float outMax, float gamma) {
  return vec3(
    applyLevels(color.r, inMin, inMax, outMin, outMax, gamma),
    applyLevels(color.g, inMin, inMax, outMin, outMax, gamma),
    applyLevels(color.b, inMin, inMax, outMin, outMax, gamma)
  );
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  
  vec3 shadows = vec3($param.colorShadowsR, $param.colorShadowsG, $param.colorShadowsB);
  vec3 midtones = vec3($param.colorMidtonesR, $param.colorMidtonesG, $param.colorMidtonesB);
  vec3 highlights = vec3($param.colorHighlightsR, $param.colorHighlightsG, $param.colorHighlightsB);
  
  vec3 result = applyColorCurve(color, shadows, midtones, highlights);
  result = applyLevels(result, $param.levelsInMin, $param.levelsInMax, $param.levelsOutMin, $param.levelsOutMax, $param.levelsGamma);
  
  $output.out = vec4(result, inColor.a);
`
};
