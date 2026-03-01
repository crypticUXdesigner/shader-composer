import type { NodeSpec } from '../../types/nodeSpec';

export const starShape2dNodeSpec: NodeSpec = {
  id: 'star-shape-2d',
  category: 'Shapes',
  displayName: 'Star',
  description: 'N-point star shape with inner/outer radius, rotation, and softness',
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
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Roundness'
    },
    starRotation: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Rotation'
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
      id: 'star-shape-main',
      label: 'Shape',
      parameters: ['starPoints', 'starInnerRadius', 'starOuterRadius', 'starRoundness', 'starRotation'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'star-shape-position',
      label: 'Position',
      parameters: ['starCenterX', 'starCenterY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'star-shape-appearance',
      label: 'Appearance',
      parameters: ['starSoftness', 'starIntensity'],
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
          'starRotation',
          'starInnerRadius',
          'starOuterRadius',
          'starRoundness',
          'starSoftness',
          'starIntensity'
        ],
        parameterUI: { starCenterX: 'coords', starCenterY: 'coords' },
        layout: {
          columns: 3,
          coordsSpan: 2
        }
      }
    ]
  },
  functions: `
float starRadius(float angle, int points, float innerR, float outerR, float rotationDeg, float roundness) {
  const float TAU = 6.283185307179586;
  float rot = rotationDeg * 0.017453292519943295; // deg to rad
  angle += rot;
  angle = mod(angle + TAU, TAU);
  float k = float(points);
  float x = angle * k / TAU;
  x = fract(x);              // [0,1)
  float m = abs(x * 2.0 - 1.0); // 0 at spike center, 1 at valley
  float t = 1.0 - m;         // 1 at spike center, 0 at valley
  // Shape profile: roundness 0 -> sharp star spikes, roundness 1 -> softer "flower" petals (current behavior)
  float exponent = mix(4.0, 1.0, clamp(roundness, 0.0, 1.0));
  t = pow(t, exponent);
  return mix(innerR, outerR, t);
}

float sdStarShape2d(vec2 p, int points, float innerR, float outerR, float rotationDeg, float roundness) {
  float angle = atan(p.y, p.x);
  float r = length(p);
  float rShape = starRadius(angle, points, innerR, outerR, rotationDeg, roundness);
  return r - rShape;
}
`,
  mainCode: `
  vec2 starCenter = vec2($param.starCenterX, $param.starCenterY);
  vec2 p = $input.in - starCenter;
  float d = sdStarShape2d(p, int($param.starPoints), $param.starInnerRadius, $param.starOuterRadius, $param.starRotation, $param.starRoundness);
  float halfSoft = $param.starSoftness * 0.5;
  float mask = 1.0 - smoothstep(-halfSoft, halfSoft, d);
  $output.out += mask * $param.starIntensity;
`
};

