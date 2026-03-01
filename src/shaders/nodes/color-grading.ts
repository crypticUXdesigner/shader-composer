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
// Color curve adjustment (simplified - works on value before color mapping)
float applyColorCurve(float value, float shadows, float midtones, float highlights) {
  float luminance = value;
  
  float adjustedValue = value;
  
  // Shadows (dark areas)
  float shadowMask = 1.0 - smoothstep(0.0, 0.33, luminance);
  adjustedValue = mix(adjustedValue, adjustedValue * shadows, shadowMask);
  
  // Midtones
  float midtoneMask = smoothstep(0.0, 0.33, luminance) * (1.0 - smoothstep(0.33, 0.66, luminance));
  adjustedValue = mix(adjustedValue, adjustedValue * midtones, midtoneMask);
  
  // Highlights (bright areas)
  float highlightMask = smoothstep(0.33, 1.0, luminance);
  adjustedValue = mix(adjustedValue, adjustedValue * highlights, highlightMask);
  
  return adjustedValue;
}

// Levels adjustment
float applyLevels(float value, float inMin, float inMax, float outMin, float outMax, float gamma) {
  value = clamp((value - inMin) / (inMax - inMin), 0.0, 1.0);
  value = pow(value, 1.0 / gamma);
  value = value * (outMax - outMin) + outMin;
  return value;
}
`,
  mainCode: `
  // Extract float value from vec4 input
  float value = $input.in.r;
  
  // Apply color grading before color mapping
  // Note: Full color grading works on RGB channels after color mapping
  // This is a simplified version that works on the value
  
  // Calculate average multipliers
  float shadows = ($param.colorShadowsR + $param.colorShadowsG + $param.colorShadowsB) / 3.0;
  float midtones = ($param.colorMidtonesR + $param.colorMidtonesG + $param.colorMidtonesB) / 3.0;
  float highlights = ($param.colorHighlightsR + $param.colorHighlightsG + $param.colorHighlightsB) / 3.0;
  
  float result = applyColorCurve(value, shadows, midtones, highlights);
  result = applyLevels(result, $param.levelsInMin, $param.levelsInMax, $param.levelsOutMin, $param.levelsOutMax, $param.levelsGamma);
  
  // Output as vec4
  $output.out = vec4(result, result, result, 1.0);
`
};
