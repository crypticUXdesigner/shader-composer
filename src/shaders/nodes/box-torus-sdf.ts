import type { NodeSpec } from '../../types/nodeSpec';
import { COOK_TORRANCE_SPECULAR_GLSL } from './cook-torrance-specular';

export const boxTorusSdfNodeSpec: NodeSpec = {
  id: 'box-torus-sdf',
  category: 'Shapes',
  displayName: 'Primitives',
  icon: 'box',
  description: '3D geometric primitives (box, torus, capsule, cylinder, cone, round cone, octahedron, icosahedron) using raymarching',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV'
    },
    {
      name: 'ro',
      type: 'vec3',
      label: 'Ray origin',
      fallbackParameter: 'cameraRoX,cameraRoY,cameraRoZ'
    },
    {
      name: 'rd',
      type: 'vec3',
      label: 'Ray direction',
      fallbackExpression: 'normalize(vec3($input.in, -1.0))'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Glow'
    }
  ],
  parameters: {
    primitiveType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 7,
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
    },
    lightType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Light Type'
    },
    lightDirX: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Dir X'
    },
    lightDirY: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Dir Y'
    },
    lightDirZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Dir Z'
    },
    lightPosX: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos X'
    },
    lightPosY: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Y'
    },
    lightPosZ: {
      type: 'float',
      default: 3.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Z'
    },
    lightIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    lightAmbient: {
      type: 'float',
      default: 0.25,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Ambient'
    },
    lightFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    },
    shadowEnable: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Shadows'
    },
    shadowSoftness: {
      type: 'float',
      default: 8.0,
      min: 1.0,
      max: 32.0,
      step: 1.0,
      label: 'Softness'
    },
    shadowSteps: {
      type: 'int',
      default: 16,
      min: 4,
      max: 48,
      step: 1,
      label: 'Steps'
    },
    specularCookTorrance: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Cook-Torrance'
    },
    specularRoughness: {
      type: 'float',
      default: 0.35,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: 'Roughness'
    },
    specularF0: {
      type: 'float',
      default: 0.04,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'F0'
    },
    cameraRoX: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ro X'
    },
    cameraRoY: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ro Y'
    },
    cameraRoZ: {
      type: 'float',
      default: 3.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Ro Z'
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
    },
    {
      id: 'light-main',
      label: 'Lighting',
      parameters: ['lightType', 'lightIntensity', 'lightAmbient'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'light-directional',
      label: 'Directional',
      parameters: ['lightDirX', 'lightDirY', 'lightDirZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'light-point',
      label: 'Point',
      parameters: ['lightPosX', 'lightPosY', 'lightPosZ', 'lightFalloff'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'shadow-main',
      label: 'Shadow',
      parameters: ['shadowEnable', 'shadowSoftness', 'shadowSteps'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'specular-main',
      label: 'Specular',
      parameters: ['specularCookTorrance', 'specularRoughness', 'specularF0'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['primitiveType', 'primitiveGlowIntensity', 'primitiveRaymarchSteps', 'primitiveCenterX', 'primitiveCenterY', 'primitiveCenterZ'],
        parameterUI: { primitiveCenterX: 'coords', primitiveCenterY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Size',
        parameters: ['primitiveSizeX', 'primitiveSizeY', 'primitiveSizeZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Rotation',
        parameters: ['primitiveRotationX', 'primitiveRotationY', 'primitiveRotationZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Lighting',
        parameters: ['lightType', 'lightAmbient', 'lightIntensity'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Directional',
        parameters: ['lightDirX', 'lightDirY', 'lightDirZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Point',
        parameters: ['lightPosX', 'lightPosY', 'lightPosZ', 'lightFalloff'],
        layout: { columns: 3, parameterSpan: { lightFalloff: 3 } }
      },
      {
        type: 'grid',
        label: 'Shadow',
        parameters: ['shadowEnable', 'shadowSoftness', 'shadowSteps'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Specular',
        parameters: ['specularCookTorrance', 'specularRoughness', 'specularF0'],
        layout: { columns: 3 }
      }
    ]
  },
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

// Icosahedron: scale s (exact SDF via symmetry fold; s clamped to avoid degenerate)
float sdIcosahedron(vec3 p, float s) {
  const float phi = (1.0 + sqrt(5.0)) / 2.0;
  float scale = max(s, 0.01);
  p = abs(p);
  float t = 0.0;
  for (int i = 0; i < 3; i++) {
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    p = p * phi - scale * phi;
    p.xy = -p.yx;
    t += 1.0;
  }
  return length(p) * pow(phi, -t);
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
  // Icosahedron: scale X (clamped inside sdIcosahedron)
  else if ($param.primitiveType == 7) {
    d = sdIcosahedron(transformedP, $param.primitiveSizeX);
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

// SDF gradient (surface normal) at point p
vec3 sdfNormal(vec3 p) {
  float eps = 0.001;
  float d = sceneSDF(p);
  float dx = sceneSDF(p + vec3(eps, 0.0, 0.0)) - d;
  float dy = sceneSDF(p + vec3(0.0, eps, 0.0)) - d;
  float dz = sceneSDF(p + vec3(0.0, 0.0, eps)) - d;
  return normalize(vec3(dx, dy, dz));
}

float directionalLight(vec3 N, vec3 lightDir) {
  return max(dot(N, normalize(lightDir)), 0.0);
}

float pointLight(vec3 p, vec3 lightPos, float intensity, float falloff) {
  vec3 toLight = lightPos - p;
  float dist = length(toLight);
  return intensity / max(1.0 + falloff * dist * dist, 0.001);
}

// Soft shadow: raymarch from hit point toward light; returns 0 = in shadow, 1 = lit
float softShadow(vec3 ro, vec3 rd, float maxDist, int steps, float softness) {
  float t = 0.0;
  float res = 1.0;
  for (int i = 0; i < 48; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) return 0.0;
    res = min(res, softness * d / max(t, 0.001));
    t += max(d, 0.01);
    if (t >= maxDist) break;
  }
  return clamp(res, 0.0, 1.0);
}
${COOK_TORRANCE_SPECULAR_GLSL}
`,
  mainCode: `
  vec3 ro = $input.ro;
  vec3 rd = normalize($input.rd);

  float t = raymarch(ro, rd, $param.primitiveRaymarchSteps);
  if (t > 0.0) {
    vec3 hitP = ro + rd * t;
    vec3 N = sdfNormal(hitP);
    vec3 V = -rd;

    float lighting = $param.lightAmbient;
    float shadow = 1.0;
    vec3 L = vec3(0.0, 0.0, 1.0);
    if ($param.lightType == 0) {
      vec3 lightDir = vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ);
      float len = length(lightDir);
      if (len > 0.001) {
        L = normalize(lightDir);
        lighting += directionalLight(N, lightDir) * $param.lightIntensity;
        if ($param.shadowEnable != 0) {
          shadow = softShadow(hitP + N * 0.02, L, 20.0, $param.shadowSteps, $param.shadowSoftness);
          lighting = $param.lightAmbient + (lighting - $param.lightAmbient) * shadow;
        }
        if ($param.specularCookTorrance != 0) {
          lighting += ctSpecular(N, V, L, $param.specularRoughness, $param.specularF0) * $param.lightIntensity * shadow;
        }
      }
    } else {
      vec3 lightPos = vec3($param.lightPosX, $param.lightPosY, $param.lightPosZ);
      float atten = pointLight(hitP, lightPos, 1.0, $param.lightFalloff);
      L = normalize(lightPos - hitP);
      float diff = max(dot(N, L), 0.0) * atten * $param.lightIntensity;
      if ($param.shadowEnable != 0) {
        float lightDist = length(lightPos - hitP);
        shadow = softShadow(hitP + N * 0.02, L, lightDist, $param.shadowSteps, $param.shadowSoftness);
      }
      lighting += diff * shadow;
      if ($param.specularCookTorrance != 0) {
        lighting += ctSpecular(N, V, L, $param.specularRoughness, $param.specularF0) * atten * $param.lightIntensity * shadow;
      }
    }

    float glow = calculateGlow(ro, rd, $param.primitiveRaymarchSteps);
    float base = (1.0 - t * 0.1) + glow * $param.primitiveGlowIntensity;
    $output.out += base * lighting;
  }
`
};
