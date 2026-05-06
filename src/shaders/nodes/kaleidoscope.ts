import type { NodeSpec } from '../../types/nodeSpec';

export const kaleidoscopeNodeSpec: NodeSpec = {
  id: 'kaleidoscope',
  category: 'Distort',
  displayName: 'Kaleidoscope',
  icon: 'compass-rose',
  description:
    'Creates symmetric patterns by mirroring/reflecting sections; optional smooth edge blends folds instead of hard mirrors',
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
      type: 'vec2',
      label: 'UV'
    }
  ],
  parameters: {
    kaleidCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X',
      knobPolarity: 'two-sided' },
    kaleidCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y',
      knobPolarity: 'two-sided' },
    kaleidSegments: {
      type: 'int',
      default: 6,
      min: 2,
      max: 32,
      step: 1,
      label: 'Segments'
    },
    kaleidRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 6.28,
      step: 0.05,
      label: 'Rotation'
    },
    kaleidEdgeSmooth: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Smooth Edge'
    }
  },
  parameterGroups: [
    {
      id: 'kaleidoscope-main',
      label: 'Kaleidoscope',
      parameters: ['kaleidCenterX', 'kaleidCenterY', 'kaleidSegments', 'kaleidRotation', 'kaleidEdgeSmooth'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['kaleidCenterX', 'kaleidCenterY', 'kaleidSegments', 'kaleidRotation', 'kaleidEdgeSmooth'],
        parameterUI: { kaleidCenterX: 'coords', kaleidCenterY: 'coords' },
        layout: {
          columns: 2,
          coordsSpan: 2,
          parameterSpan: { kaleidSegments: 2 }
        }
      }
    ]
  },
  functions: `
vec2 kaleidoscopeFold(vec2 p, int segments, float rotation, float smoothEdge) {
  float angle = atan(p.y, p.x);
  float radius = length(p);
  angle = mod(angle + rotation, 6.28318);
  float segmentAngle = 6.28318 / float(max(segments, 2));
  int segment = int(angle / segmentAngle);
  float segmentStart = float(segment) * segmentAngle;
  float localAngle = angle - segmentStart;
  float halfSeg = segmentAngle * 0.5;
  if (smoothEdge <= 0.0) {
    if (localAngle > halfSeg) {
      localAngle = segmentAngle - localAngle;
    }
  } else {
    float t = smoothstep(halfSeg - smoothEdge, halfSeg + smoothEdge, localAngle);
    localAngle = mix(localAngle, segmentAngle - localAngle, t);
  }
  angle = segmentStart + localAngle;
  return vec2(cos(angle), sin(angle)) * radius;
}
`,
  mainCode: `
  vec2 kaleidCenter = vec2($param.kaleidCenterX, $param.kaleidCenterY);
  vec2 offsetP = $input.in - kaleidCenter;
  offsetP = kaleidoscopeFold(offsetP, $param.kaleidSegments, $param.kaleidRotation, $param.kaleidEdgeSmooth);
  $output.out = kaleidCenter + offsetP;
`
};
