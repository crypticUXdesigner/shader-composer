import type { NodeSpec } from '../../types';

export const kaleidoscopeSmoothNodeSpec: NodeSpec = {
  id: 'kaleidoscope-smooth',
  category: 'Distort',
  displayName: 'Kaleidoscope Smooth',
  icon: 'ikosaedr',
  description: 'Kaleidoscope with smooth folding at segment edges for softer symmetry',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
    }
  ],
  parameters: {
    kaleidSmoothCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    kaleidSmoothCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    kaleidSmoothSegments: {
      type: 'int',
      default: 6,
      min: 2,
      max: 32,
      step: 1,
      label: 'Segments'
    },
    kaleidSmoothRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 6.28,
      step: 0.05,
      label: 'Rotation'
    },
    kaleidSmoothEdge: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Smooth Edge'
    }
  },
  parameterGroups: [
    {
      id: 'kaleid-smooth-main',
      label: 'Kaleidoscope Smooth',
      parameters: ['kaleidSmoothCenterX', 'kaleidSmoothCenterY', 'kaleidSmoothSegments', 'kaleidSmoothRotation', 'kaleidSmoothEdge'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
vec2 kaleidoscopeSmooth(vec2 p, int segments, float rotation, float smoothEdge) {
  float angle = atan(p.y, p.x);
  float radius = length(p);
  angle = mod(angle + rotation, 6.28318);
  float segmentAngle = 6.28318 / float(max(segments, 2));
  int segment = int(angle / segmentAngle);
  float segmentStart = float(segment) * segmentAngle;
  float localAngle = angle - segmentStart;
  float halfSeg = segmentAngle * 0.5;
  float t = smoothstep(halfSeg - smoothEdge, halfSeg + smoothEdge, localAngle);
  localAngle = mix(localAngle, segmentAngle - localAngle, t);
  angle = segmentStart + localAngle;
  return vec2(cos(angle), sin(angle)) * radius;
}
`,
  mainCode: `
  vec2 center = vec2($param.kaleidSmoothCenterX, $param.kaleidSmoothCenterY);
  vec2 offsetP = $input.in - center;
  offsetP = kaleidoscopeSmooth(offsetP, $param.kaleidSmoothSegments, $param.kaleidSmoothRotation, $param.kaleidSmoothEdge);
  $output.out = center + offsetP;
`
};
