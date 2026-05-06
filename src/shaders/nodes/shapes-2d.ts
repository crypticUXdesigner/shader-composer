import type { NodeSpec } from '../../types/nodeSpec';

export const shapes2dNodeSpec: NodeSpec = {
  id: 'shapes-2d',
  category: 'Shapes',
  displayName: 'Shapes',
  icon: 'shapes-filled',
  description: '2D shape mask: ellipse, rounded box, superellipse, regular polygon, capsule. Aspect from size.',
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
    shapeType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 4,
      step: 1,
      label: 'Shape'
    },
    sizeX: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Width'
    },
    sizeY: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Height'
    },
    centerX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X',
      knobPolarity: 'two-sided' },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y',
      knobPolarity: 'two-sided' },
    roundness: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Roundness'
    },
    rotation: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Rotation',
      knobPolarity: 'two-sided'
    },
    polygonSides: {
      type: 'int',
      default: 6,
      min: 3,
      max: 32,
      step: 1,
      label: 'Sides'
    },
    superPower: {
      type: 'float',
      default: 2.5,
      min: 0.5,
      max: 20.0,
      step: 0.1,
      label: 'Power'
    },
    softness: {
      type: 'float',
      default: 0.02,
      min: 0.0,
      max: 0.5,
      step: 0.001,
      label: 'Softness'
    },
    intensity: {
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
      id: 'shapes-2d-shape',
      label: 'Shape',
      parameters: ['shapeType', 'sizeX', 'sizeY', 'rotation', 'polygonSides', 'superPower'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'shapes-2d-position',
      label: 'Position',
      parameters: ['centerX', 'centerY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'shapes-2d-roundness',
      label: 'Roundness',
      parameters: ['roundness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'shapes-2d-appearance',
      label: 'Appearance',
      parameters: ['softness', 'intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'shapeType',
          'sizeX',
          'sizeY',
          'centerX',
          'centerY',
          'roundness',
          'rotation',
          'polygonSides',
          'superPower',
          'softness',
          'intensity'
        ],
        parameterUI: { sizeX: 'coords', sizeY: 'coords', centerX: 'coords', centerY: 'coords' },
        layout: {
          columns: 2,
          coordsSpan: 2,
          coordsOrigin: { sizeX: 'bottom-left', centerX: 'center' },
          parameterSpan: {
            shapeType: 2,
            roundness: 2,
            rotation: 2,
            polygonSides: 2,
            superPower: 2,
            softness: 2,
            intensity: 2
          }
        }
      }
    ]
  },
  functions: `
vec2 shapes2d_rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

float sdEllipse(vec2 p, float rx, float ry) {
  vec2 q = p / vec2(rx, ry);
  return length(q) - 1.0;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Approx distance in normalized space for regular N-gon (circumradius = r).
float sdRegularPolygon(vec2 p, float r, float n) {
  float ang = atan(p.y, p.x);
  float sector = 6.28318530718 / max(n, 3.0);
  float halfSector = sector * 0.5;
  float k = cos(floor((ang + halfSector) / sector) * sector - ang);
  return length(p) * k - r;
}

float sdCapsule2D(vec2 p, float halfLen, float r) {
  vec2 a = vec2(-halfLen, 0.0);
  vec2 b = vec2(halfLen, 0.0);
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float superellipseMask(vec2 p, float rx, float ry, float n) {
  vec2 q = abs(p) / vec2(max(rx, 0.0001), max(ry, 0.0001));
  return pow(q.x, n) + pow(q.y, n);
}
`,
  mainCode: `
  vec2 center = vec2($param.centerX, $param.centerY);
  vec2 p = $input.in - center;
  p = shapes2d_rotate2D(p, radians($param.rotation));
  float d;
  if ($param.shapeType == 0) {
    float rx = $param.sizeX * 0.5;
    float ry = $param.sizeY * 0.5;
    d = sdEllipse(p, rx, ry);
  } else if ($param.shapeType == 1) {
    vec2 halfSize = vec2($param.sizeX * 0.5, $param.sizeY * 0.5);
    d = sdRoundBox(p, halfSize, $param.roundness);
  } else if ($param.shapeType == 2) {
    // Superellipse: use k=1 isocontour, consistent with superellipse node
    float rx = $param.sizeX * 0.5;
    float ry = $param.sizeY * 0.5;
    float k = superellipseMask(p, rx, ry, $param.superPower);
    float halfSoft = $param.softness * 0.5;
    float mask = 1.0 - smoothstep(1.0 - halfSoft, 1.0 + halfSoft, k);
    $output.out += mask * $param.intensity;
    return;
  } else if ($param.shapeType == 3) {
    // Regular polygon: computed in normalized space (supports non-uniform width/height)
    float rx = max($param.sizeX * 0.5, 0.0001);
    float ry = max($param.sizeY * 0.5, 0.0001);
    vec2 q = p / vec2(rx, ry);
    float sides = clamp(float($param.polygonSides), 3.0, 32.0);
    d = sdRegularPolygon(q, 1.0, sides);
  } else {
    // Capsule: length from sizeX, thickness from sizeY (segment aligned to X)
    float halfLen = max($param.sizeX * 0.25, 0.0);
    float r = max($param.sizeY * 0.25, 0.0);
    d = sdCapsule2D(p, halfLen, r);
  }
  float mask;
  if ($param.shapeType == 0 || $param.shapeType == 3) {
    float halfSoft = $param.softness * 0.5;
    mask = 1.0 - smoothstep(-halfSoft, halfSoft, d);
  } else {
    float soft = max($param.softness, 0.0001);
    mask = 1.0 - smoothstep(0.0, soft, d);
  }
  $output.out += mask * $param.intensity;
`
};
