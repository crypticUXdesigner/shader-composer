import type { NodeSpec } from '../../types/nodeSpec';

export const cylinderConeNodeSpec: NodeSpec = {
  id: 'cylinder-cone',
  category: 'Shapes',
  displayName: 'Cylinder & Cone',
  icon: 'cylinder',
  description: '3D cylinder and cone primitives using signed distance fields and raymarching',
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
      label: 'Glow'
    }
  ],
  parameters: {
    primitiveType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Shape'
    },
    primitiveCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    primitiveCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    primitiveCenterZ: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Z'
    },
    primitiveSizeX: {
      type: 'float',
      default: 0.5,
      min: 0.05,
      max: 3.0,
      step: 0.05,
      label: 'Radius'
    },
    primitiveSizeY: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: 'Height'
    },
    primitiveSizeZ: {
      type: 'float',
      default: 0.5,
      min: 0.05,
      max: 2.0,
      step: 0.05,
      label: 'Top Radius'
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
      label: 'Direction X'
    },
    lightDirY: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Direction Y'
    },
    lightDirZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Direction Z'
    },
    lightPosX: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Position X'
    },
    lightPosY: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Position Y'
    },
    lightPosZ: {
      type: 'float',
      default: 3.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Position Z'
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
      }
    ]
  },
  functions: `
// Capped cylinder SDF (Y-up): radius r, half-height h
float sdCylinder(vec3 p, float r, float h) {
  vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Capped cone SDF (Y-up): half-height h, radius r1 at y=-h, radius r2 at y=+h (Top Radius)
float sdCappedCone(vec3 p, float h, float r1, float r2) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
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

// Scene SDF: cylinder or cone
float sceneSDF(vec3 p) {
  vec3 center = vec3($param.primitiveCenterX, $param.primitiveCenterY, $param.primitiveCenterZ);
  vec3 transformedP = p - center;

  transformedP = rotateX(transformedP, $param.primitiveRotationX);
  transformedP = rotateY(transformedP, $param.primitiveRotationY);
  transformedP = rotateZ(transformedP, $param.primitiveRotationZ);

  float r = $param.primitiveSizeX;
  float h = $param.primitiveSizeY * 0.5;
  float topR = $param.primitiveSizeZ;

  if ($param.primitiveType == 0) {
    return sdCylinder(transformedP, r, h);
  } else {
    return sdCappedCone(transformedP, h, r, topR);
  }
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

// Directional light (N and lightDir in same space)
float directionalLight(vec3 N, vec3 lightDir) {
  return max(dot(N, normalize(lightDir)), 0.0);
}

// Point light attenuation at hit point p
float pointLight(vec3 p, vec3 lightPos, float intensity, float falloff) {
  vec3 toLight = lightPos - p;
  float dist = length(toLight);
  return intensity / max(1.0 + falloff * dist * dist, 0.001);
}
`,
  mainCode: `
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3($input.in, -1.0));

  float t = raymarch(ro, rd, $param.primitiveRaymarchSteps);
  if (t > 0.0) {
    vec3 hitP = ro + rd * t;
    vec3 N = sdfNormal(hitP);

    float lighting = $param.lightAmbient;
    if ($param.lightType == 0) {
      vec3 lightDir = vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ);
      float len = length(lightDir);
      if (len > 0.001) lighting += directionalLight(N, lightDir) * $param.lightIntensity;
    } else {
      vec3 lightPos = vec3($param.lightPosX, $param.lightPosY, $param.lightPosZ);
      float atten = pointLight(hitP, lightPos, 1.0, $param.lightFalloff);
      vec3 toLight = normalize(lightPos - hitP);
      lighting += max(dot(N, toLight), 0.0) * atten * $param.lightIntensity;
    }

    float glow = calculateGlow(ro, rd, $param.primitiveRaymarchSteps);
    float base = (1.0 - t * 0.1) + glow * $param.primitiveGlowIntensity;
    $output.out += base * lighting;
  }
`
};
