import type { NodeSpec } from '../../types/nodeSpec';

export const hexVoxelNodeSpec: NodeSpec = {
  id: 'hex-voxel',
  category: 'Shapes',
  displayName: 'Hex Voxel',
  description:
    '2D view over a 3D voxel field as hex-grid slices with orbit (yaw/pitch), layered painter\'s-algorithm composite and optional glow.',
  icon: 'box',
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
      type: 'vec4',
      label: 'Color'
    }
  ],
  parameters: {
    shapeType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Shape'
    },
    layerCount: {
      type: 'int',
      default: 30,
      min: 10,
      max: 50,
      step: 1,
      label: 'Layers'
    },
    rotationSpeedX: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.05,
      label: 'Yaw'
    },
    rotationSpeedY: {
      type: 'float',
      default: 0.3,
      min: -2.0,
      max: 2.0,
      step: 0.05,
      label: 'Pitch'
    },
    timeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.05,
      label: 'Time Speed'
    },
    timeOffset: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Time Offset'
    },
    zoom: {
      type: 'float',
      default: 4.0,
      min: 1.0,
      max: 15.0,
      step: 0.1,
      label: 'Zoom'
    },
    panX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.05,
      label: 'Pan X'
    },
    panY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.05,
      label: 'Pan Y'
    },
    layerSpacing: {
      type: 'float',
      default: 0.3,
      min: 0.05,
      max: 1.0,
      step: 0.01,
      label: 'Layer Spacing'
    },
    baseColorR: {
      type: 'float',
      default: 0.25,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Color R'
    },
    baseColorG: {
      type: 'float',
      default: 0.45,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Color G'
    },
    baseColorB: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Color B'
    },
    glowIntensity: {
      type: 'float',
      default: 0.15,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Glow'
    },
    glowColorR: {
      type: 'float',
      default: 0.25,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Glow R'
    },
    glowColorG: {
      type: 'float',
      default: 0.45,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Glow G'
    },
    glowColorB: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Glow B'
    },
    edgeDarken: {
      type: 'float',
      default: 0.4,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Edge Darken'
    },
    edgeWidth: {
      type: 'float',
      default: 0.08,
      min: 0.01,
      max: 0.3,
      step: 0.01,
      label: 'Edge Width'
    },
    layerOpacity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: 'Layer Opacity'
    },
    lightDirX: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Light X'
    },
    lightDirY: {
      type: 'float',
      default: 0.5,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Light Y'
    },
    lightDirZ: {
      type: 'float',
      default: 1.0,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Light Z'
    },
    ambient: {
      type: 'float',
      default: 0.4,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Ambient'
    }
  },
  parameterGroups: [
    {
      id: 'shape',
      label: 'Shape',
      parameters: ['shapeType', 'layerCount'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'camera',
      label: 'Camera',
      parameters: ['rotationSpeedX', 'rotationSpeedY', 'zoom', 'panX', 'panY', 'layerSpacing'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'color',
      label: 'Color',
      parameters: ['baseColorR', 'baseColorG', 'baseColorB', 'glowIntensity', 'glowColorR', 'glowColorG', 'glowColorB', 'edgeDarken', 'edgeWidth', 'layerOpacity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'light',
      label: 'Light',
      parameters: ['lightDirX', 'lightDirY', 'lightDirZ', 'ambient'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'animation',
      label: 'Animation',
      parameters: ['timeSpeed', 'timeOffset'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['shapeType', 'layerCount'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Camera',
        parameters: ['rotationSpeedX', 'rotationSpeedY', 'zoom', 'panX', 'panY', 'layerSpacing'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Color',
        parameters: ['baseColorR', 'baseColorG', 'baseColorB', 'glowIntensity', 'glowColorR', 'glowColorG', 'glowColorB', 'edgeDarken', 'edgeWidth', 'layerOpacity'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Light',
        parameters: ['lightDirX', 'lightDirY', 'lightDirZ', 'ambient'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['timeSpeed', 'timeOffset'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
// Hex grid: world position p (2D) -> cell ivec2 and edge distance (flat-top hex, size 1)
void hexVoxelize(vec2 p, inout ivec2 cell, inout float edgeDist) {
  const float HEX_SQ3 = 1.7320508;
  const float HEX_HALF = 0.8660254;
  float jf = floor(p.y / 1.5);
  int j = int(jf);
  float ix = (p.x - mod(jf, 2.0) * HEX_HALF) / HEX_SQ3;
  int i = int(floor(ix));
  cell = ivec2(i, j);
  vec2 center = vec2(float(i) * HEX_SQ3 + mod(float(j), 2.0) * HEX_HALF, float(j) * 1.5);
  vec2 local = p - center;
  vec2 ap = abs(local);
  edgeDist = max(dot(ap, vec2(0.5, HEX_HALF)), ap.x) - 0.5;
}

// Rotate 2D point
vec2 rotate2D(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Rotate 3D point around Y (yaw: left/right)
vec3 rotate3DY(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
}

// Rotate 3D point around X (pitch: up/down)
vec3 rotate3DX(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

// Box SDF at origin
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// Sphere SDF
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Map 0: rotating layered boxes (boxy) — centered at vox origin so visible in view
float mapBoxy(vec3 vox, float animTime) {
  vec3 p = vox;
  float t = animTime * 0.5;
  p.xy = rotate2D(p.xy, t);
  p.xz = rotate2D(p.xz, t * 0.7);
  vec3 b = vec3(3.0, 3.0, 1.5);
  return sdBox(p, b);
}

// Map 1: sphere minus box (sphere-minus-box) — centered at vox origin
float mapSphereMinusBox(vec3 vox, float animTime) {
  vec3 p = vox;
  float t = animTime * 0.4;
  p.xy = rotate2D(p.xy, t);
  float sph = sdSphere(p, 6.0);
  vec3 q = p;
  q.xy = rotate2D(q.xy, t * 0.8);
  float bx = sdBox(q, vec3(4.0, 4.0, 5.0));
  return max(sph, -bx);
}

// Map 2: simple heightmap (y < f(x,z)) — terrain centered at origin
float mapHeightmap(vec3 vox, float animTime) {
  vec3 p = vox;
  float t = animTime * 0.3;
  p.xz = rotate2D(p.xz, t);
  float h = 2.0 * sin(p.x * 0.3) * cos(p.z * 0.3);
  return p.y - h;
}

// Sample map by shape type at 3D position (float)
float mapAtVec3(int shapeType, vec3 p, float animTime) {
  if (shapeType == 0) return mapBoxy(p, animTime);
  if (shapeType == 1) return mapSphereMinusBox(p, animTime);
  return mapHeightmap(p, animTime);
}
`,
  mainCode: `
  float animTime = $time * clamp($param.timeSpeed, 0.0, 3.0) + $param.timeOffset;
  vec2 uv = $input.in;
  float zoom = clamp($param.zoom, 1.0, 15.0);
  uv *= zoom;
  uv += vec2($param.panX, $param.panY);
  float yaw = animTime * clamp($param.rotationSpeedX, -2.0, 2.0);
  float pitch = animTime * clamp($param.rotationSpeedY, -2.0, 2.0);

  int shapeType = int(clamp(float($param.shapeType), 0.0, 2.0));
  int layerCount = int(clamp(float($param.layerCount), 10.0, 50.0));
  vec3 baseColor = vec3($param.baseColorR, $param.baseColorG, $param.baseColorB);
  vec3 glowColor = vec3($param.glowColorR, $param.glowColorG, $param.glowColorB);
  float glowIntensity = clamp($param.glowIntensity, 0.0, 1.0);
  float edgeDarken = clamp($param.edgeDarken, 0.0, 1.0);
  float edgeWidth = clamp($param.edgeWidth, 0.01, 0.3);
  float layerOpacity = clamp($param.layerOpacity, 0.0, 2.0);
  float layerSpacing = clamp($param.layerSpacing, 0.05, 1.0);
  float ambient = clamp($param.ambient, 0.0, 1.0);
  vec3 lightDir = normalize(vec3($param.lightDirX, $param.lightDirY, $param.lightDirZ));

  vec4 acc = vec4(0.0, 0.0, 0.0, 0.0);
  const int MAX_LAYERS = 50;

  for (int layer = 0; layer < MAX_LAYERS; layer++) {
    if (layer >= layerCount) break;
    float layerZ = float(layer - layerCount / 2);
    vec2 sliceUV = uv;
    ivec2 cell;
    float edgeDist;
    hexVoxelize(sliceUV, cell, edgeDist);
    vec3 voxPos = vec3(float(cell.x), float(cell.y), layerZ);
    voxPos = rotate3DY(voxPos, yaw);
    voxPos = rotate3DX(voxPos, pitch);
    float d = mapAtVec3(shapeType, voxPos, animTime);
    float inside = step(d, 0.0);
    float distToEdge = abs(edgeDist);
    float edge = 1.0 - smoothstep(0.0, edgeWidth, distToEdge);
    float face = 1.0 - edge * edgeDarken;
    vec3 N = vec3(0.0, 0.0, 1.0);
    float diff = max(dot(N, lightDir), 0.0);
    float diffuse = 1.0 - ambient;
    vec3 shaded = baseColor * (ambient + diffuse * diff) * face;
    float alpha = inside * (0.85 + 0.15 * edge);
    vec4 layerCol = vec4(shaded, alpha * 0.12 * layerOpacity);
    acc.rgb += layerCol.a * layerCol.rgb;
    acc.a += layerCol.a;
    if (acc.a > 0.98) break;
  }

  float glow = glowIntensity * (1.0 - acc.a);
  acc.rgb += vec3(glow, glow, glow) * glowColor;
  acc.a = min(acc.a + glow * 0.5, 1.0);
  $output.out = vec4(acc.rgb, 1.0);
`
};
