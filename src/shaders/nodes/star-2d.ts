import type { NodeSpec } from '../../types/nodeSpec';

export const star2dNodeSpec: NodeSpec = {
  id: 'star-2d',
  category: 'Shapes',
  displayName: 'Starburst',
  description: 'Radial starburst segment mask with inner/outer radius and optional rounded corners',
  icon: 'star',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Position'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Value'
    }
  ],
  parameters: {
    starCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    starCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    starPoints: {
      type: 'int',
      default: 5,
      min: 3,
      max: 32,
      step: 1,
      label: 'Points'
    },
    starInnerRadius: {
      type: 'float',
      default: 0.15,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Inner Radius'
    },
    starOuterRadius: {
      type: 'float',
      default: 0.35,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Outer Radius'
    },
    starRoundness: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Roundness'
    },
    starSoftness: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.5,
      step: 0.005,
      label: 'Softness'
    },
    starIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'star-shape',
      label: 'Shape',
      parameters: ['starPoints', 'starInnerRadius', 'starOuterRadius'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'star-position',
      label: 'Position',
      parameters: ['starCenterX', 'starCenterY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'star-appearance',
      label: 'Appearance',
      parameters: ['starRoundness', 'starSoftness', 'starIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'starCenterX',
          'starCenterY',
          'starPoints',
          'starRoundness',
          'starInnerRadius',
          'starOuterRadius',
          'starSoftness',
          'starIntensity'
        ],
        parameterUI: { starCenterX: 'coords', starCenterY: 'coords' },
        layout: {
          columns: 3,
          coordsSpan: 2,
          parameterSpan: {
            starIntensity: 2
          }
        }
      }
    ]
  },
  functions: `
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float sdStar2d(vec2 p, int points, float innerR, float outerR, float roundness) {
  const float PI = 3.14159265359;
  float n = float(points);
  float an = 2.0 * PI / n;
  float angle = atan(p.y, p.x);
  float r = length(p);
  float sector = floor((angle + PI) / an);
  angle = mod(angle + PI, an) - 0.5 * an;
  vec2 q = vec2(cos(angle), sin(angle)) * r;
  float halfAngle = 0.5 * an;
  vec2 pa = vec2(innerR * cos(halfAngle), innerR * sin(halfAngle));
  vec2 pb = vec2(outerR, 0.0);
  float d = sdSegment(q, pa, pb);
  if (roundness > 0.001) {
    d -= roundness;
  }
  return d;
}
`,
  mainCode: `
  vec2 starCenter = vec2($param.starCenterX, $param.starCenterY);
  vec2 p = $input.in - starCenter;
  float d = sdStar2d(p, int($param.starPoints), $param.starInnerRadius, $param.starOuterRadius, $param.starRoundness);
  float halfSoft = $param.starSoftness * 0.5;
  float mask = 1.0 - smoothstep(-halfSoft, halfSoft, d);
  $output.out += mask * $param.starIntensity;
`
};
