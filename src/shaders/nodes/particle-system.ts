import type { NodeSpec } from '../../types/nodeSpec';

export const particleSystemNodeSpec: NodeSpec = {
  id: 'particle-system',
  category: 'Patterns',
  displayName: 'Speckle Grain',
  description:
    'Film-grain-like speckle mask: soft spots on a UV grid with smooth drift over time (density vs spot width are separate knobs)',
  icon: 'grain',
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
      label: 'Grain'
    }
  ],
  parameters: {
    particleCellSize: {
      type: 'float',
      default: 0.25,
      min: 0.05,
      max: 2.0,
      step: 0.01,
      label: 'Grid spacing'
    },
    particleCount: {
      type: 'int',
      default: 1,
      min: 1,
      max: 4,
      step: 1,
      label: 'Specks per cell'
    },
    particleSize: {
      type: 'float',
      default: 0.1,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: 'Spot radius'
    },
    particleIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    },
    particleFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Spot sharpness'
    },
    particleTimeSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 5.0,
      step: 0.001,
      label: 'Drift speed'
    },
    particleTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.001,
      label: 'Phase offset',
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'grain-main',
      label: 'Grain',
      parameters: ['particleCellSize', 'particleCount', 'particleFalloff', 'particleSize', 'particleIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'grain-animation',
      label: 'Motion',
      parameters: ['particleTimeSpeed', 'particleTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['particleCellSize', 'particleCount', 'particleFalloff', 'particleSize', 'particleIntensity'],
        layout: { columns: 3, parameterSpan: { particleCount: 2 } }
      },
      {
        type: 'grid',
        label: 'Motion',
        parameters: ['particleTimeSpeed', 'particleTimeOffset'],
        layout: { columns: 3, parameterSpan: { particleTimeOffset: 2 } }
      }
    ]
  },
  functions: `
// Hash function for particle positions
float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

vec2 hash2(float n) {
  return fract(sin(vec2(n, n + 1.0)) * vec2(43758.5453, 22578.1459));
}

vec2 particleCell(vec2 p, float cellSize) {
  return floor(p / cellSize);
}

// Smooth drift in UV space (time scales drift rate; 0 speed freezes phase)
vec2 speckleSpotUv(vec2 cell, float time, float particleId) {
  float seed = dot(cell, vec2(12.9898, 78.233)) + particleId * 9.17;
  vec2 base = hash2(seed);
  float sx = hash(seed + 11.1);
  float sy = hash(seed + 22.2);
  float tau = 6.28318530718;
  vec2 wobble = vec2(sin(time + sx * tau), cos(time * 1.07 + sy * tau));
  return fract(base + 0.2 * wobble);
}

float particleInfluence(vec2 p, vec2 particlePos, float size, float intensity, float falloff) {
  float f = max(falloff, 0.01);
  float dist = length(p - particlePos);
  return exp(-dist * dist * f / (2.0 * size * size)) * intensity;
}

float particleSystem(vec2 p, float time, float cellSize, int particlesPerCell) {
  vec2 cell = particleCell(p, cellSize);
  float value = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 neighborCell = cell + vec2(float(x), float(y));
      for (int i = 0; i < 4; i++) {
        if (i >= particlesPerCell) break;
        float particleId = float(i) + dot(neighborCell, vec2(12.9898, 78.233));
        vec2 particleLocalPos = speckleSpotUv(neighborCell, time, particleId);
        vec2 worldPos = neighborCell * cellSize + particleLocalPos * cellSize;
        float influence = particleInfluence(p, worldPos, $param.particleSize, $param.particleIntensity, $param.particleFalloff);
        value += influence;
      }
    }
  }
  return min(value, 1.0);
}
`,
  mainCode: `
  float particleTime = ($time + $param.particleTimeOffset) * $param.particleTimeSpeed;
  float particles = particleSystem($input.in, particleTime, $param.particleCellSize, $param.particleCount);
  $output.out += particles;
`
};
