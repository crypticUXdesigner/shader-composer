import type { NodeSpec } from '../../types';

export const voronoiNoiseNodeSpec: NodeSpec = {
  id: 'voronoi-noise',
  category: 'Patterns',
  displayName: 'Voronoi',
  description: 'Cell-like patterns using Voronoi diagrams, creating organic crystal-like structures',
  icon: 'noise',
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
    voronoiScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 20.0,
      step: 0.01,
      label: 'Scale'
    },
    voronoiJitter: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Jitter'
    },
    voronoiDistanceMetric: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Distance Metric'
    },
    voronoiDriftDirection: {
      type: 'float',
      default: 56.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Drift Direction'
    },
    voronoiDriftAmount: {
      type: 'float',
      default: 0.18,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Drift Amount'
    },
    voronoiAnimationMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Animation'
    },
    voronoiRotationSpeed: {
      type: 'float',
      default: 30.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Rot. Speed'
    },
    voronoiTimeSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    voronoiIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    voronoiTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    voronoiOutputMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 3,
      step: 1,
      label: 'Output'
    }
  },
  parameterGroups: [
    {
      id: 'voronoi-main',
      label: 'Voronoi',
      parameters: ['voronoiScale', 'voronoiJitter', 'voronoiDistanceMetric'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'voronoi-animation',
      label: 'Animation',
      parameters: ['voronoiAnimationMode', 'voronoiDriftDirection', 'voronoiDriftAmount', 'voronoiRotationSpeed', 'voronoiTimeSpeed', 'voronoiTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'voronoi-output',
      label: 'Output',
      parameters: ['voronoiOutputMode', 'voronoiIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// Rotate point around origin (angle in radians)
vec2 voronoiRotate(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

// Random 2D vector
vec2 random2(vec2 p) {
  return fract(
    sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453
  );
}

// Hash cell id to 0-1
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Voronoi: returns vec4(F1, F2, cellIdHash 0-1, 0)
vec4 voronoiFull(vec2 p, float jitter, int metric) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  vec2 cellId = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = random2(i + neighbor) * jitter;
      vec2 diff = neighbor + point - f;
      float dist = 0.0;
      if (metric == 0) {
        dist = length(diff);
      } else if (metric == 1) {
        dist = abs(diff.x) + abs(diff.y);
      } else {
        dist = max(abs(diff.x), abs(diff.y));
      }
      if (dist < f1) {
        f2 = f1;
        f1 = dist;
        cellId = i + neighbor;
      } else if (dist < f2) {
        f2 = dist;
      }
    }
  }
  float cellHash = hash21(cellId);
  return vec4(f1, f2, cellHash, 0.0);
}
`,
  mainCode: `
  float voronoiTime = ($time + $param.voronoiTimeOffset) * $param.voronoiTimeSpeed;
  float scale = max($param.voronoiScale, 0.001);
  vec2 domain = $input.in * scale;
  int animMode = $param.voronoiAnimationMode;
  if (animMode == 0) {
    float angleRad = $param.voronoiDriftDirection * 0.017453292519943295;
    vec2 driftDir = vec2(cos(angleRad), sin(angleRad));
    domain += driftDir * voronoiTime * $param.voronoiDriftAmount;
  } else if (animMode == 1) {
    float rotAngle = voronoiTime * $param.voronoiRotationSpeed * 0.017453292519943295;
    domain = voronoiRotate(domain, rotAngle);
  }
  vec4 v = voronoiFull(domain, $param.voronoiJitter, $param.voronoiDistanceMetric);
  float f1 = v.x;
  float f2 = v.y;
  float cellHash = v.z;
  float value = 0.0;
  int mode = $param.voronoiOutputMode;
  if (mode == 0) {
    value = clamp(f1 * 0.7, 0.0, 1.0);
  } else if (mode == 1) {
    value = clamp((f2 - f1) * 2.0, 0.0, 1.0);
  } else if (mode == 2) {
    value = smoothstep(0.0, 0.08, f2 - f1);
  } else {
    value = cellHash;
  }
  $output.out += value * $param.voronoiIntensity;
`
};
