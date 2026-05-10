import type { NodeSpec } from '../../types/nodeSpec';

export const planeGridNodeSpec: NodeSpec = {
  id: 'plane-grid',
  category: 'Patterns',
  displayName: 'Grid',
  icon: 'grid',
  description: 'UV-driven square grids, checkerboard, or an infinite-plane slice (ray preset)',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Pattern'
    }
  ],
  parameters: {
    planeType: {
      type: 'int',
      default: 1,
      min: 0,
      max: 2,
      step: 1,
      label: 'Pattern'
    },
    planeScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      label: 'Tile scale'
    },
    planeSpacing: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Cell size'
    },
    planeLineWidth: {
      type: 'float',
      default: 0.009,
      min: 0.001,
      max: 0.5,
      step: 0.001,
      label: 'Line width'
    },
    planeIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    planeRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rotation'
    },
    planeNormalX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Plane Nx',
      knobPolarity: 'two-sided'
    },
    planeNormalY: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Plane Ny',
      knobPolarity: 'two-sided'
    },
    planeNormalZ: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Plane Nz',
      knobPolarity: 'two-sided'
    },
    planeHeight: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Height',
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'plane-main',
      label: 'Layout',
      parameters: [
        'planeType',
        'planeScale',
        'planeSpacing',
        'planeLineWidth',
        'planeRotation',
        'planeIntensity'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'plane-raymarched',
      label: 'Infinite plane',
      parameters: ['planeNormalX', 'planeNormalY', 'planeNormalZ', 'planeHeight'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'planeType',
          'planeScale',
          'planeSpacing',
          'planeLineWidth',
          'planeRotation',
          'planeIntensity'
        ],
        layout: { columns: 2, parameterSpan: { planeType: 2, planeIntensity: 2 } }
      },
      {
        type: 'grid',
        label: 'Infinite plane',
        parameters: ['planeNormalX', 'planeNormalY', 'planeNormalZ', 'planeHeight'],
        layout: { columns: 2 },
        visibleWhen: { parameter: 'planeType', equals: 0 }
      }
    ]
  },
  functions: `
// Infinite plane SDF
float sdPlane(vec3 p, vec3 n, float h) {
  float nLen = length(n);
  vec3 nNorm = nLen > 0.001 ? normalize(n) : vec3(0.0, 1.0, 0.0);
  return dot(p, nNorm) + h;
}

// Distance to nearest cell edge along one axis (absolute units; stable for +/- coords).
float pgCellEdgeDist(float coord, float period) {
  float s = max(period, 1e-5);
  float q = coord - floor(coord / s) * s;
  return min(q, s - q);
}

// spacing = repeat period; lineWidth = stroke thickness on the grid (same UV units), capped per cell.
float gridPattern(vec2 p, float spacing, float lineWidth) {
  float s = max(spacing, 1e-5);
  float hw = clamp(0.5 * max(lineWidth, 1e-6), 1e-6, s * 0.495);
  float dx = pgCellEdgeDist(p.x, s);
  float dy = pgCellEdgeDist(p.y, s);
  float vx = 1.0 - step(hw, dx);
  float vy = 1.0 - step(hw, dy);
  return max(vx, vy);
}

// Checkerboard pattern
float checkerboard(vec2 p, float size) {
  vec2 c = floor(p / size);
  return mod(c.x + c.y, 2.0);
}

// Rotate point
vec2 rotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Stable orthonormal basis (tangentU, tangentV) on the plane perpendicular to unit normal n.
void pgPlaneFrame(vec3 n, out vec3 tangentU, out vec3 tangentV) {
  vec3 helper = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  tangentU = normalize(cross(helper, n));
  tangentV = cross(n, tangentU);
}
`,
  mainCode: `
  // Option 1: 2D grid pattern
  if ($param.planeType == 1) {
    vec2 rotatedP = rotate($input.in, $param.planeRotation * 3.14159 / 180.0);
    float pattern = gridPattern(rotatedP * $param.planeScale, $param.planeSpacing, $param.planeLineWidth);
    $output.out += pattern * $param.planeIntensity;
  }
  // Option 2: Checkerboard
  else if ($param.planeType == 2) {
    vec2 rotatedP = rotate($input.in, $param.planeRotation * 3.14159 / 180.0);
    float pattern = checkerboard(rotatedP * $param.planeScale, $param.planeSpacing);
    $output.out += pattern * $param.planeIntensity;
  }
  // Option 3: Ray–plane hit; reject grazing rays; sample grid in plane tangent space (matches any normal).
  else if ($param.planeType == 0) {
    const float PG_GRAZING_EPS = 1.0e-4;
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3($input.in, -1.0));
    vec3 pn = normalize(vec3($param.planeNormalX, $param.planeNormalY, $param.planeNormalZ));
    float denom = dot(rd, pn);
    if (abs(denom) > PG_GRAZING_EPS) {
      float sdRo = sdPlane(ro, pn, $param.planeHeight);
      float t = -sdRo / denom;
      if (t > 0.0) {
        vec3 hitPoint = ro + rd * t;
        vec3 tangentU;
        vec3 tangentV;
        pgPlaneFrame(pn, tangentU, tangentV);
        vec2 planarUv = vec2(dot(hitPoint, tangentU), dot(hitPoint, tangentV));
        vec2 rotatedP = rotate(planarUv * $param.planeScale, $param.planeRotation * 3.14159 / 180.0);
        float pattern = gridPattern(rotatedP, $param.planeSpacing, $param.planeLineWidth);
        $output.out += pattern * $param.planeIntensity;
      }
    }
  }
`
};
