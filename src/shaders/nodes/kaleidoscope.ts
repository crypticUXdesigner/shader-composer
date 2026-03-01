import type { NodeSpec } from '../../types/nodeSpec';

export const kaleidoscopeNodeSpec: NodeSpec = {
  id: 'kaleidoscope',
  category: 'Distort',
  displayName: 'Kaleidoscope',
  icon: 'compass-rose',
  description: 'Creates symmetric patterns by mirroring/reflecting sections of the image',
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
      label: 'Center X'
    },
    kaleidCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
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
    }
  },
  parameterGroups: [
    {
      id: 'kaleidoscope-main',
      label: 'Kaleidoscope',
      parameters: ['kaleidCenterX', 'kaleidCenterY', 'kaleidSegments', 'kaleidRotation'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['kaleidCenterX', 'kaleidCenterY', 'kaleidSegments', 'kaleidRotation'],
        parameterUI: { kaleidCenterX: 'coords', kaleidCenterY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      }
    ]
  },
  functions: `
vec2 kaleidoscope(vec2 p, int segments, float rotation) {
  float angle = atan(p.y, p.x);
  float radius = length(p);
  
  // Normalize angle to 0..2PI
  angle = mod(angle + rotation, 6.28318);
  
  // Calculate segment angle
  float segmentAngle = 6.28318 / float(max(segments, 2));
  
  // Find which segment we're in
  int segment = int(angle / segmentAngle);
  
  // Mirror to first segment
  float segmentStart = float(segment) * segmentAngle;
  float localAngle = angle - segmentStart;
  
  // Mirror if in second half of segment
  if (localAngle > segmentAngle * 0.5) {
    localAngle = segmentAngle - localAngle;
  }
  
  // Reconstruct position
  angle = segmentStart + localAngle;
  return vec2(cos(angle), sin(angle)) * radius;
}
`,
  mainCode: `
  vec2 kaleidCenter = vec2($param.kaleidCenterX, $param.kaleidCenterY);
  vec2 offsetP = $input.in - kaleidCenter;
  offsetP = kaleidoscope(offsetP, $param.kaleidSegments, $param.kaleidRotation);
  $output.out = kaleidCenter + offsetP;
`
};
