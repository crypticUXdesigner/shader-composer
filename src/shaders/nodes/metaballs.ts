import type { NodeSpec } from '../../types/nodeSpec';

export const metaballsNodeSpec: NodeSpec = {
  id: 'metaballs',
  category: 'Shapes',
  displayName: 'Metaballs',
  icon: 'sphere',
  description: '3D raymarched metaballs: soft blobs that blend where their fields overlap',
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
    blobCount: {
      type: 'int',
      default: 4,
      min: 2,
      max: 6,
      step: 1,
      label: 'Blobs'
    },
    blobRadius: {
      type: 'float',
      default: 0.25,
      min: 0.05,
      max: 1.0,
      step: 0.01,
      label: 'Blob Size'
    },
    threshold: {
      type: 'float',
      default: 4.0,
      min: 0.5,
      max: 20.0,
      step: 0.1,
      label: 'Threshold'
    },
    orbitRadius: {
      type: 'float',
      default: 0.35,
      min: 0.0,
      max: 1.5,
      step: 0.01,
      label: 'Orbit'
    },
    centerX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    centerZ: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Z'
    },
    timeSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 3.0,
      step: 0.05,
      label: 'Orbit Speed'
    },
    timeOffset: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Offset'
    },
    raymarchSteps: {
      type: 'int',
      default: 64,
      min: 16,
      max: 128,
      step: 1,
      label: 'Raymarch'
    },
    glowIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: 'Glow'
    }
  },
  parameterGroups: [
    {
      id: 'metaballs',
      label: 'Metaballs',
      parameters: ['blobCount', 'blobRadius', 'threshold', 'orbitRadius'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'position',
      label: 'Position',
      parameters: ['centerX', 'centerY', 'centerZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'animation',
      label: 'Animation',
      parameters: ['timeSpeed', 'timeOffset'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'appearance',
      label: 'Appearance',
      parameters: ['raymarchSteps', 'glowIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'blobCount',
          'blobRadius',
          'threshold',
          'centerX',
          'centerY',
          'centerZ',
          'orbitRadius',
          'raymarchSteps',
          'glowIntensity'
        ],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['timeSpeed', 'timeOffset'],
        layout: {
          columns: 3,
          parameterSpan: { timeOffset: 2 }
        }
      }
    ]
  },
  functions: `
// Blob center: orbit around scene center with phase per blob
vec3 metaballCenter(int i, vec3 center, float orbitRadius, float t) {
  float phase = float(i) * 6.28318530718 / 6.0;
  float a = t + phase;
  return center + orbitRadius * vec3(cos(a), sin(a), 0.0);
}

// Field F(p) = sum_i r^2 / (|p - c_i|^2 + eps). Surface at F >= threshold.
float metaballField(vec3 p, vec3 center, float orbitRadius, float blobRadius, float t, int blobCount) {
  float r2 = blobRadius * blobRadius;
  float sum = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= blobCount) break;
    vec3 c = metaballCenter(i, center, orbitRadius, t);
    vec3 d = p - c;
    float d2 = dot(d, d) + 1e-6;
    sum += r2 / d2;
  }
  return sum;
}

// Gradient of F for raymarch step size
vec3 metaballGradient(vec3 p, vec3 center, float orbitRadius, float blobRadius, float t, int blobCount) {
  float r2 = blobRadius * blobRadius;
  vec3 grad = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= blobCount) break;
    vec3 c = metaballCenter(i, center, orbitRadius, t);
    vec3 d = p - c;
    float d2 = dot(d, d) + 1e-6;
    grad -= 2.0 * r2 * d / (d2 * d2);
  }
  return grad;
}
`,
  mainCode: `
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3($input.in, -1.0));

  vec3 center = vec3($param.centerX, $param.centerY, $param.centerZ);
  float orbitRadius = $param.orbitRadius;
  float blobRadius = $param.blobRadius;
  float threshold = $param.threshold;
  float t = $time * $param.timeSpeed + $param.timeOffset;
  int blobCount = int(clamp(float($param.blobCount), 2.0, 6.0));
  int steps = $param.raymarchSteps;
  float glowIntensity = $param.glowIntensity;

  float rayT = 0.0;
  float hit = 0.0;
  float glow = 0.0;

  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * rayT;
    float F = metaballField(p, center, orbitRadius, blobRadius, t, blobCount);

    if (F >= threshold) {
      hit = 1.0 - rayT * 0.08;
      glow += glowIntensity / (1.0 + (F - threshold) * 2.0);
      break;
    }

    vec3 grad = metaballGradient(p, center, orbitRadius, blobRadius, t, blobCount);
    float gradLen = length(grad) + 1e-5;
    float stepSize = (threshold - F) / gradLen;
    stepSize = clamp(stepSize, 0.002, 0.5);
    rayT += stepSize;

    glow += glowIntensity * stepSize / (1.0 + (threshold - F) * 2.0);

    if (rayT > 50.0) break;
  }

  $output.out += hit + clamp(glow * 0.15, 0.0, 1.0);
`
};
