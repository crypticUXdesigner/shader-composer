import type { NodeSpec } from '../../types/nodeSpec';

export const blurNodeSpec: NodeSpec = {
  id: 'blur',
  category: 'Effects',
  displayName: 'Blur',
  description:
    'WebGPU: Gaussian/directional/radial separable blur (multipass before Final Output; inline approximation when chained earlier). WebGL preview: luminance soften gated by Amount, scaled by Radius, with directional/radial modulation from Mode/Direction/Center.',
  icon: 'blur-circle',
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
    blurAmount: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Amount'
    },
    blurRadius: {
      type: 'float',
      default: 5.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Radius'
    },
    blurType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Mode'
    },
    blurDirection: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Direction'
    },
    blurCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X',
      knobPolarity: 'two-sided'
    },
    blurCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y',
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'blur-controls',
      label: 'Blur',
      parameters: [
        'blurAmount',
        'blurRadius',
        'blurType',
        'blurDirection',
        'blurCenterX',
        'blurCenterY'
      ],
      collapsible: false,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['blurAmount', 'blurRadius', 'blurType'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        visibleWhen: { parameter: 'blurType', equals: 1 },
        parameters: ['blurDirection'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        visibleWhen: { parameter: 'blurType', equals: 2 },
        parameters: ['blurCenterX', 'blurCenterY'],
        parameterUI: { blurCenterX: 'coords', blurCenterY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      }
    ]
  },
  functions: `
// Simple softening effect (approximation since we can't sample neighbors easily)
float soften(float value, float amount) {
  // Simple smoothing approximation
  return value * (1.0 - amount) + 0.5 * amount;
}
`,
  mainCode: `
  vec4 inColor = $input.in;
  vec3 color = inColor.rgb;
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  vec2 pc = ((gl_FragCoord.xy / $resolution.xy * 2.0 - 1.0) * vec2($resolution.x / $resolution.y, 1.0));
  // Align with WebGPU pass plan: no soften until Amount > 0; Radius scales contribution (sigma uses amount × radius).
  float userAmt = clamp($param.blurAmount, 0.0, 1.0);
  float radScale = clamp($param.blurRadius / 20.0, 0.0, 1.0);
  float amt = userAmt * radScale;
  float typeF = float($param.blurType);
  vec2 cen = vec2($param.blurCenterX, $param.blurCenterY);
  float ang = radians($param.blurDirection);
  vec2 blurAxis = vec2(cos(ang), sin(ang));
  float w = amt;
  if (typeF > 0.5 && typeF < 1.5) {
    float ani = clamp(0.45 + pow(abs(dot(pc, blurAxis)), 2.0), 0.35, 1.35);
    w *= ani;
  } else if (typeF >= 1.5) {
    float radial = clamp(1.1 - length(pc - cen) * 0.08, 0.25, 1.25);
    w *= radial;
  }
  float softened = soften(lum, clamp(w, 0.0, 1.0));
  vec3 resultRgb = lum > 1e-4 ? clamp(color * (softened / lum), 0.0, 1.0) : vec3(softened);
  $output.out = vec4(resultRgb, inColor.a);
`
};
