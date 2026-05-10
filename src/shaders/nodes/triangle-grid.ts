import type { NodeSpec } from '../../types/nodeSpec';

export const triangleGridNodeSpec: NodeSpec = {
  id: 'triangle-grid',
  category: 'Patterns',
  displayName: 'Triangle Grid',
  description:
    'Regular triangular tiling with configurable edges and edge-to-fill blend; optional infinite-plane slice like Grid',
  icon: 'triangle',
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
      label: 'Pattern'
    }
  ],
  parameters: {
    triProjection: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'Projection'
    },
    triScale: {
      type: 'float',
      default: 0.25,
      min: 0.05,
      max: 2.0,
      step: 0.01,
      label: 'Cell'
    },
    triLineWidth: {
      type: 'float',
      default: 0.02,
      min: 0.001,
      max: 0.3,
      step: 0.002,
      label: 'Line Width'
    },
    triRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rotation'
    },
    triIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    triFill: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Edge / Fill mix'
    },
    triPlaneScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      label: 'Plane tile scale'
    },
    triPlaneNormalX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Plane Nx',
      knobPolarity: 'two-sided'
    },
    triPlaneNormalY: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Plane Ny',
      knobPolarity: 'two-sided'
    },
    triPlaneNormalZ: {
      type: 'float',
      default: 0.2,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Plane Nz',
      knobPolarity: 'two-sided'
    },
    triPlaneHeight: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Plane height',
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'tri-projection',
      label: 'Projection',
      parameters: ['triProjection'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'tri-grid',
      label: 'Grid',
      parameters: ['triScale', 'triLineWidth', 'triRotation'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'tri-output',
      label: 'Output',
      parameters: ['triIntensity', 'triFill'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'tri-infinite-plane',
      label: 'Infinite plane',
      parameters: ['triPlaneScale', 'triPlaneNormalX', 'triPlaneNormalY', 'triPlaneNormalZ', 'triPlaneHeight'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Projection',
        parameters: ['triProjection'],
        parameterUI: { triProjection: 'enum' },
        layout: { columns: 2, parameterSpan: { triProjection: 2 } }
      },
      {
        type: 'grid',
        label: 'Grid',
        parameters: ['triScale', 'triLineWidth', 'triRotation'],
        layout: { columns: 2, parameterSpan: { triRotation: 2 } }
      },
      {
        type: 'grid',
        label: 'Output',
        parameters: ['triIntensity', 'triFill'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Infinite plane',
        parameters: ['triPlaneScale', 'triPlaneNormalX', 'triPlaneNormalY', 'triPlaneNormalZ', 'triPlaneHeight'],
        layout: { columns: 2, parameterSpan: { triPlaneHeight: 2 } },
        visibleWhen: { parameter: 'triProjection', equals: 0 }
      }
    ]
  },
  functions: `
// Infinite plane SDF (same convention as Grid)
float sdPlane(vec3 p, vec3 n, float h) {
  float nLen = length(n);
  vec3 nNorm = nLen > 0.001 ? normalize(n) : vec3(0.0, 1.0, 0.0);
  return dot(p, nNorm) + h;
}

// Stable orthonormal basis on the plane perpendicular to unit normal n.
void tgPlaneFrame(vec3 n, out vec3 tangentU, out vec3 tangentV) {
  vec3 helper = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  tangentU = normalize(cross(helper, n));
  tangentV = cross(n, tangentU);
}

// Equilateral triangle grid: three line families at 0°, 60°, 120°.
// Returns distance to nearest edge and a 0/1 cell parity for fill.
void triangleGrid(vec2 p, float spacing, out float distToEdge, out float cellId) {
  const float sqrt3 = 1.7320508;
  float s = max(0.001, spacing);

  // Parametric coordinates along each line family (period = s in p-space).
  float u0 = p.x / s;
  float u1 = (p.x * 0.5 + p.y * (sqrt3 * 0.5)) / s;
  float u2 = (-p.x * 0.5 + p.y * (sqrt3 * 0.5)) / s;

  // Distance from p to the nearest line in each family.
  float d0 = abs(fract(u0 + 0.5) - 0.5) * s;
  float d1 = abs(fract(u1 + 0.5) - 0.5) * s;
  float d2 = abs(fract(u2 + 0.5) - 0.5) * s;

  distToEdge = min(min(d0, d1), d2);

  // Parity of summed cell indices → 0 or 1, used as the alternating fill mask.
  vec3 fl = vec3(floor(u0 + 0.5), floor(u1 + 0.5), floor(u2 + 0.5));
  cellId = mod(fl.x + fl.y + fl.z, 2.0);
}

vec2 rotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}
`,
  mainCode: `
  float valid = 1.0;
  float distToEdge = 0.0;
  float cellId = 0.0;

  if ($param.triProjection == 1) {
    vec2 p = rotate($input.in, $param.triRotation * 3.14159 / 180.0);
    triangleGrid(p, max(0.001, $param.triScale), distToEdge, cellId);
  } else {
    valid = 0.0;
    const float TG_GRAZING_EPS = 1.0e-4;
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3($input.in, -1.0));
    vec3 pn = normalize(vec3($param.triPlaneNormalX, $param.triPlaneNormalY, $param.triPlaneNormalZ));
    float denom = dot(rd, pn);
    if (abs(denom) > TG_GRAZING_EPS) {
      float sdRo = sdPlane(ro, pn, $param.triPlaneHeight);
      float t = -sdRo / denom;
      if (t > 0.0) {
        vec3 hitPoint = ro + rd * t;
        vec3 tangentU;
        vec3 tangentV;
        tgPlaneFrame(pn, tangentU, tangentV);
        vec2 planarUv = vec2(dot(hitPoint, tangentU), dot(hitPoint, tangentV));
        vec2 p = rotate(planarUv * $param.triPlaneScale, $param.triRotation * 3.14159 / 180.0);
        triangleGrid(p, max(0.001, $param.triScale), distToEdge, cellId);
        valid = 1.0;
      }
    }
  }

  float lineWidth = max(0.0001, $param.triLineWidth);
  float edge = 1.0 - smoothstep(0.0, lineWidth, distToEdge);
  float fillVal = cellId;
  float pattern = mix(edge, fillVal, $param.triFill);
  $output.out += pattern * $param.triIntensity * valid;
`
};
