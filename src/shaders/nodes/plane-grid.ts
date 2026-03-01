import type { NodeSpec } from '../../types/nodeSpec';

export const planeGridNodeSpec: NodeSpec = {
  id: 'plane-grid',
  category: 'Patterns',
  displayName: 'Grid',
  icon: 'grid',
  description: 'Creates infinite plane or grid patterns for structured geometric backgrounds',
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
      label: 'Grid'
    }
  ],
  parameters: {
    planeType: {
      type: 'int',
      default: 1,
      min: 0,
      max: 2,
      step: 1,
      label: 'Type'
    },
    planeScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      label: 'Scale'
    },
    planeSpacing: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Spacing'
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
      label: 'Norm X'
    },
    planeNormalY: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Norm Y'
    },
    planeNormalZ: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Norm Z'
    },
    planeHeight: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Height'
    }
  },
  parameterGroups: [
    {
      id: 'plane-main',
      label: 'Grid',
      parameters: ['planeType', 'planeScale', 'planeSpacing', 'planeRotation', 'planeIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'plane-raymarched',
      label: 'Raymarched',
      parameters: ['planeNormalX', 'planeNormalY', 'planeNormalZ', 'planeHeight'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['planeType', 'planeScale', 'planeSpacing', 'planeRotation', 'planeIntensity'],
        layout: { columns: 2, parameterSpan: { planeType: 2 } }
      },
      {
        type: 'grid',
        label: 'Raymarched',
        parameters: ['planeNormalX', 'planeNormalY', 'planeNormalZ', 'planeHeight'],
        layout: { columns: 2 }
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

// Grid pattern
float gridPattern(vec2 p, float spacing) {
  vec2 cell = floor(p / spacing);
  vec2 local = mod(p, spacing) / spacing;
  
  // Grid lines
  float grid = 0.0;
  float lineWidth = 0.02;
  
  // Vertical lines
  if (local.x < lineWidth || local.x > 1.0 - lineWidth) {
    grid = 1.0;
  }
  // Horizontal lines
  if (local.y < lineWidth || local.y > 1.0 - lineWidth) {
    grid = 1.0;
  }
  
  return grid;
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
`,
  mainCode: `
  // Option 1: 2D grid pattern
  if ($param.planeType == 1) {
    vec2 rotatedP = rotate($input.in, $param.planeRotation * 3.14159 / 180.0);
    float pattern = gridPattern(rotatedP * $param.planeScale, $param.planeSpacing);
    $output.out += pattern * $param.planeIntensity;
  }
  // Option 2: Checkerboard
  else if ($param.planeType == 2) {
    vec2 rotatedP = rotate($input.in, $param.planeRotation * 3.14159 / 180.0);
    float pattern = checkerboard(rotatedP * $param.planeScale, $param.planeSpacing);
    $output.out += pattern * $param.planeIntensity;
  }
  // Option 3: Raymarched plane (simplified - uses 2D projection)
  else if ($param.planeType == 0) {
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3($input.in, -1.0));
    vec3 planeNormal = normalize(vec3($param.planeNormalX, $param.planeNormalY, $param.planeNormalZ));
    float t = -sdPlane(ro, planeNormal, $param.planeHeight) / dot(rd, planeNormal);
    if (t > 0.0) {
      vec3 hitPoint = ro + rd * t;
      float pattern = gridPattern(hitPoint.xy, $param.planeSpacing);
      $output.out += pattern * $param.planeIntensity;
    }
  }
`
};
