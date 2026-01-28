import type { NodeSpec } from '../../types';

export const hexagonalGridNodeSpec: NodeSpec = {
  id: 'hexagonal-grid',
  category: 'Patterns',
  displayName: 'Hexagonal Grid',
  description: 'Creates hexagonal tiling patterns for structured, geometric backgrounds',
  icon: 'hexagon',
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
    hexSize: {
      type: 'float',
      default: 0.25,
      min: 0.1,
      max: 3.0,
      step: 0.01,
      label: 'Cell'
    },
    hexGap: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 0.45,
      step: 0.01,
      label: 'Gap'
    },
    hexCellRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rotation'
    },
    hexSizeVariation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Variation'
    },
    hexSizeVariationSteps: {
      type: 'int',
      default: 0,
      min: 0,
      max: 16,
      step: 1,
      label: 'Steps'
    },
    hexRotation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rotation'
    },
    hexIntensity: {
      type: 'float',
      default: 0.35,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    hexIntensityVariation: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity Var'
    },
    hexSoftness: {
      type: 'float',
      default: 0.01,
      min: 0.0001,
      max: 0.1,
      step: 0.0005,
      label: 'Softness'
    },
    hexEdgeThickness: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Edge Width'
    },
    hexEdgeIntensity: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Edge Intensity'
    },
    hexRimWidth: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Rim Width'
    },
    hexRimIntensity: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Rim Intensity'
    },
    hexSeed: {
      type: 'int',
      default: 0,
      min: 0,
      max: 9999,
      step: 1,
      label: 'Seed'
    },
    hexPulseSpeed: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 20.0,
      step: 0.01,
      label: 'Speed'
    },
    hexPulseDepth: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Depth'
    },
    hexWaveDirection: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Direction'
    },
    hexWaveFrequency: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 40.0,
      step: 0.01,
      label: 'Frequency'
    },
    hexWaveSpeed: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 20.0,
      step: 0.01,
      label: 'Speed'
    },
    hexWaveDepth: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Depth'
    }
  },
  parameterGroups: [
    {
      id: 'hex-cells',
      label: 'Cells',
      parameters: ['hexSize', 'hexSizeVariation', 'hexSizeVariationSteps', 'hexGap', 'hexCellRotation'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'hex-grid',
      label: 'Grid',
      parameters: ['hexRotation', 'hexIntensity', 'hexIntensityVariation', 'hexSeed'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'hex-edges',
      label: 'Edges',
      parameters: ['hexSoftness', 'hexEdgeThickness', 'hexEdgeIntensity', 'hexRimWidth', 'hexRimIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'hex-pulse',
      label: 'Pulse',
      parameters: ['hexPulseDepth', 'hexPulseSpeed'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'hex-wave',
      label: 'Wave',
      parameters: ['hexWaveDepth', 'hexWaveFrequency', 'hexWaveDirection', 'hexWaveSpeed'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
// Pointy-top hex axial mapping with cube rounding for true nearest-hex-cell
vec2 hexAxialRounded(vec2 p, float size) {
  // size = hex circumradius (center->vertex) for this mapping
  const float sqrt3 = 1.7320508;

  // axial coords (q,r)
  vec2 h = vec2(
    (sqrt3/3.0 * p.x - 1.0/3.0 * p.y) / size,
    (2.0/3.0 * p.y) / size
  );

  // cube rounding
  float x = h.x;
  float z = h.y;
  float y = -x - z;

  float rx = round(x);
  float ry = round(y);
  float rz = round(z);

  float dx = abs(rx - x);
  float dy = abs(ry - y);
  float dz = abs(rz - z);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz)       ry = -rx - rz;
  else                    rz = -rx - ry;

  // return rounded axial (q,r) as (rx, rz)
  return vec2(rx, rz);
}

vec2 hexCenterFromAxial(vec2 axial, float size) {
  // convert rounded axial back to center position in 2D
  const float sqrt3 = 1.7320508;
  float rx = axial.x;
  float rz = axial.y;
  vec2 center = vec2(
    size * sqrt3 * (rx + rz * 0.5),
    size * 1.5 * rz
  );

  return center;
}

vec2 hexLocal(vec2 p, vec2 axial, float size) {
  return p - hexCenterFromAxial(axial, size);
}

float hash12(vec2 p) {
  // Stable hash to 0..1 (good enough for per-cell variation)
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float hexSDF(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

float hexPattern(vec2 p, float r, float cellAngleRad) {
  // Baseline orientation: align SDF hex to our grid at 0°
  const float baseAngle = 0.5235988; // pi/6 = 30°
  float a = baseAngle + cellAngleRad;
  float c = cos(a);
  float s = sin(a);
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  
  float d = hexSDF(p, r);
  return 1.0 - smoothstep(-0.01, 0.01, d);
}

vec2 rotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}
`,
  mainCode: `
  vec2 p = rotate($input.in, $param.hexRotation * 3.14159 / 180.0);
  
  // size = circumradius (center to vertex) - consistent definition throughout
  // Global scale so the same UI value produces a smaller visual cell size.
  // (e.g. "0.1" is now visually smaller than it used to be)
  float size = $param.hexSize * 0.25;
  
  vec2 cell = hexAxialRounded(p, size);
  vec2 center = hexCenterFromAxial(cell, size);
  vec2 local = p - center;
  
  // hexSDF expects inradius, convert from circumradius: inradius = circumradius * sqrt(3) / 2
  const float sqrt3 = 1.7320508;
  float inradius = size * sqrt3 * 0.5;

  // Gap is a fraction of the cell size (0 = touching, higher = more margin)
  float gap = clamp($param.hexGap, 0.0, 0.95);
  
  // Per-cell size variation changes shape size inside a fixed grid cell (tiling stays stable).
  float seed = float($param.hexSeed);
  float sizeRnd = hash12(cell + seed);
  if ($param.hexSizeVariationSteps > 1) {
    float steps = float($param.hexSizeVariationSteps);
    sizeRnd = floor(sizeRnd * steps) / max(1.0, steps - 1.0);
  }
  float sizeMul = 1.0 + (sizeRnd * 2.0 - 1.0) * $param.hexSizeVariation;
  sizeMul = max(sizeMul, 0.0);
  
  float patternInradius = max(inradius * (1.0 - gap) * sizeMul, 0.0);
  
  // Rotate each hexagon (shape) inside the fixed grid
  float cellAngleRad = $param.hexCellRotation * 3.14159 / 180.0;
  
  // Compute SDF (so we can derive fill, edge, rim)
  const float baseAngle = 0.5235988; // pi/6 = 30°
  float a = baseAngle + cellAngleRad;
  vec2 lp = rotate(local, a);
  float d = hexSDF(lp, patternInradius);
  
  float aa = max($param.hexSoftness, 1e-5);
  float fill = 1.0 - smoothstep(-aa, aa, d);
  
  float edgeW = patternInradius * clamp($param.hexEdgeThickness, 0.0, 1.0);
  float edge = 1.0 - smoothstep(edgeW, edgeW + aa, abs(d));
  
  float rimW = patternInradius * clamp($param.hexRimWidth, 0.0, 1.0);
  float rim = 0.0;
  if (rimW > 0.0) {
    // Thin band just inside the edge
    rim = smoothstep(-rimW - aa, -rimW + aa, d) - smoothstep(-aa, aa, d);
    rim = clamp(rim, 0.0, 1.0);
  }
  
  // Per-cell intensity variation (stable by cell id)
  float intRnd = hash12(cell + seed + 17.23);
  float intMul = 1.0 + (intRnd * 2.0 - 1.0) * $param.hexIntensityVariation;
  intMul = max(intMul, 0.0);
  
  // Random-phase pulse (great for audio driving via Pulse Depth)
  float phase = hash12(cell + seed + 91.7) * 6.2831853;
  float pulse = 1.0 + $param.hexPulseDepth * sin($time * $param.hexPulseSpeed + phase);
  pulse = max(pulse, 0.0);
  
  // Traveling wave across the grid (uses cell centers for smooth spatial coherence)
  float waveMul = 1.0;
  if ($param.hexWaveDepth > 0.0 && ($param.hexWaveFrequency > 0.0 || $param.hexWaveSpeed > 0.0)) {
    float th = $param.hexWaveDirection * 3.14159 / 180.0;
    vec2 wdir = vec2(cos(th), sin(th));
    float wave = sin(dot(center, wdir) * $param.hexWaveFrequency + $time * $param.hexWaveSpeed);
    waveMul = 1.0 + wave * $param.hexWaveDepth;
    waveMul = max(waveMul, 0.0);
  }
  
  float value = fill * $param.hexIntensity * intMul * pulse * waveMul;
  float edgeValue = edge * $param.hexEdgeIntensity;
  float rimValue = rim * $param.hexRimIntensity;
  
  $output.out += value + edgeValue + rimValue;
`
};
