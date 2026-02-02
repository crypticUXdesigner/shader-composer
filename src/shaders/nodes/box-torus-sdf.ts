import type { NodeSpec } from '../../types';

export const boxTorusSdfNodeSpec: NodeSpec = {
  id: 'box-torus-sdf',
  category: 'Shapes',
  displayName: 'SDF',
  icon: 'box',
  description: '3D geometric primitives (box, torus, capsule, cylinder, cone, round cone, octahedron) using raymarching',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float'
    }
  ],
  parameters: {
    primitiveType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 6,
      step: 1,
      label: 'Shape'
    },
    primitiveCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'X'
    },
    primitiveCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Y'
    },
    primitiveCenterZ: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Z'
    },
    primitiveSizeX: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Size X'
    },
    primitiveSizeY: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Size Y'
    },
    primitiveSizeZ: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: 'Size Z'
    },
    primitiveRotationX: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Rotation X'
    },
    primitiveRotationY: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Rotation Y'
    },
    primitiveRotationZ: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Rotation Z'
    },
    primitiveGlowIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: 'Glow'
    },
    primitiveRaymarchSteps: {
      type: 'int',
      default: 40,
      min: 10,
      max: 200,
      step: 1,
      label: 'Raymarch'
    }
  },
  parameterGroups: [
    {
      id: 'primitive-main',
      label: 'Primitive',
      parameters: ['primitiveType', 'primitiveGlowIntensity', 'primitiveRaymarchSteps'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'primitive-position',
      label: 'Position',
      parameters: ['primitiveCenterX', 'primitiveCenterY', 'primitiveCenterZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'primitive-size',
      label: 'Size',
      parameters: ['primitiveSizeX', 'primitiveSizeY', 'primitiveSizeZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'primitive-rotation',
      label: 'Rotation',
      parameters: ['primitiveRotationX', 'primitiveRotationY', 'primitiveRotationZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
// Box SDF
float sdBox(vec3 p, vec3 size) {
  vec3 q = abs(p) - size;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Torus SDF
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

// Capsule SDF
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Capped cylinder (vertical): radius r, half-height h
float sdCappedCylinder(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Capped cone: height h, base radius r1, top radius r2 (axis Y)
float sdCappedCone(vec3 p, float h, float r1, float r2) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}

// Round cone: base radius r1, tip radius r2, height h
float sdRoundCone(vec3 p, float r1, float r2, float h) {
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  vec2 q = vec2(length(p.xz), p.y);
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}

// Octahedron: scale s (exact SDF)
float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
  if (3.0 * p.x < m) q = p.xyz;
  else if (3.0 * p.y < m) q = p.yzx;
  else if (3.0 * p.z < m) q = p.zxy;
  else return m * 0.57735027;
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k));
}

// Rotate point around X axis
vec3 rotateX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

// Rotate point around Y axis
vec3 rotateY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

// Rotate point around Z axis
vec3 rotateZ(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}

// Scene SDF combining all primitives
float sceneSDF(vec3 p) {
  vec3 center = vec3($param.primitiveCenterX, $param.primitiveCenterY, $param.primitiveCenterZ);
  vec3 transformedP = p - center;
  
  // Apply rotation
  transformedP = rotateX(transformedP, $param.primitiveRotationX);
  transformedP = rotateY(transformedP, $param.primitiveRotationY);
  transformedP = rotateZ(transformedP, $param.primitiveRotationZ);
  
  float d = 1000.0;
  
  // Box
  if ($param.primitiveType == 0) {
    d = sdBox(transformedP, vec3($param.primitiveSizeX, $param.primitiveSizeY, $param.primitiveSizeZ));
  }
  // Torus
  else if ($param.primitiveType == 1) {
    d = sdTorus(transformedP, vec2($param.primitiveSizeX, $param.primitiveSizeY));
  }
  // Capsule
  else if ($param.primitiveType == 2) {
    vec3 a = vec3(0.0, -$param.primitiveSizeY, 0.0);
    vec3 b = vec3(0.0, $param.primitiveSizeY, 0.0);
    d = sdCapsule(transformedP, a, b, $param.primitiveSizeX);
  }
  // Cylinder (capped, vertical): radius X, half-height Y
  else if ($param.primitiveType == 3) {
    d = sdCappedCylinder(transformedP, $param.primitiveSizeX, $param.primitiveSizeY);
  }
  // Cone (capped): height Y, base radius X, top radius Z
  else if ($param.primitiveType == 4) {
    d = sdCappedCone(transformedP, $param.primitiveSizeY, $param.primitiveSizeX, $param.primitiveSizeZ);
  }
  // Round cone: base radius X, tip radius Z, height Y
  else if ($param.primitiveType == 5) {
    d = sdRoundCone(transformedP, $param.primitiveSizeX, $param.primitiveSizeZ, $param.primitiveSizeY);
  }
  // Octahedron: scale X
  else if ($param.primitiveType == 6) {
    d = sdOctahedron(transformedP, $param.primitiveSizeX);
  }
  
  return d;
}

// Raymarching
float raymarch(vec3 ro, vec3 rd, int steps) {
  float t = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) {
      return t;
    }
    t += d;
    if (t > 100.0) break;
  }
  return -1.0;
}

// Glow calculation
float calculateGlow(vec3 ro, vec3 rd, int steps) {
  float t = 0.0;
  float glow = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) break;
    glow += 1.0 / (1.0 + d * d * 10.0);
    t += max(d, 0.01);
    if (t > 100.0) break;
  }
  return glow / float(steps);
}
`,
  mainCode: `
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3($input.in, -1.0));
  
  float t = raymarch(ro, rd, $param.primitiveRaymarchSteps);
  if (t > 0.0) {
    float glow = calculateGlow(ro, rd, $param.primitiveRaymarchSteps);
    $output.out += (1.0 - t * 0.1) + glow * $param.primitiveGlowIntensity;
  }
`
};
