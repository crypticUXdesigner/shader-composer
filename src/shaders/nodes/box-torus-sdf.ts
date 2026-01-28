import type { NodeSpec } from '../../types';

export const boxTorusSdfNodeSpec: NodeSpec = {
  id: 'box-torus-sdf',
  category: 'Shapes',
  displayName: 'SDF',
  icon: 'box',
  description: 'Additional 3D geometric primitives (box, torus, capsule) using raymarching',
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
      max: 2,
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
      label: 'Size X / Radius'
    },
    primitiveSizeY: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Size Y / Thickness'
    },
    primitiveSizeZ: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Size Z (Box only)'
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
      label: 'Glow Intensity'
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
