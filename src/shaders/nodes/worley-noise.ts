import type { NodeSpec } from '../../types/nodeSpec';

export const worleyNoiseNodeSpec: NodeSpec = {
  id: 'worley-noise',
  category: 'Patterns',
  displayName: 'Worley',
  description: 'Cellular (Worley) noise: same grid-and-jitter structure as Voronoi with F1, F2−F1, or edge output',
  icon: 'cell',
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
      label: 'Noise'
    }
  ],
  parameters: {
    worleyScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 20.0,
      step: 0.01,
      label: 'Scale'
    },
    worleyJitter: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Jitter'
    },
    worleyDistanceMetric: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Distance Metric'
    },
    worleyOutputMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 2,
      step: 1,
      label: 'Output'
    },
    worleyTimeSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    worleyTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    worleyIntensity: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'worley-main',
      label: 'Cellular',
      parameters: ['worleyDistanceMetric', 'worleyScale', 'worleyJitter', 'worleyOutputMode', 'worleyIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'worley-animation',
      label: 'Animation',
      parameters: ['worleyTimeSpeed', 'worleyTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    minColumns: 2,
    elements: [
      {
        type: 'grid',
        parameters: ['worleyDistanceMetric', 'worleyScale', 'worleyJitter', 'worleyOutputMode', 'worleyIntensity'],
        layout: { columns: 2, parameterSpan: { worleyDistanceMetric: 2 } }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['worleyTimeSpeed', 'worleyTimeOffset'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
vec2 random2(vec2 p) {
  return fract(
    sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453
  );
}

vec4 worleyFull(vec2 p, float jitter, int metric) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;

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
      } else if (dist < f2) {
        f2 = dist;
      }
    }
  }
  return vec4(f1, f2, 0.0, 0.0);
}
`,
  mainCode: `
  float worleyTime = ($time + $param.worleyTimeOffset) * $param.worleyTimeSpeed;
  float scale = max($param.worleyScale, 0.001);
  vec4 v = worleyFull($input.in * scale + vec2(worleyTime * 0.1, worleyTime * 0.15), $param.worleyJitter, $param.worleyDistanceMetric);
  float f1 = v.x;
  float f2 = v.y;
  float value = 0.0;
  int mode = $param.worleyOutputMode;
  if (mode == 0) {
    value = clamp(f1 * 0.7, 0.0, 1.0);
  } else if (mode == 1) {
    value = clamp((f2 - f1) * 2.0, 0.0, 1.0);
  } else {
    value = smoothstep(0.0, 0.08, f2 - f1);
  }
  $output.out += value * $param.worleyIntensity;
`
};
