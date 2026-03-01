import type { NodeSpec } from '../../types/nodeSpec';

/** Golden ratio for spherical Fibonacci lattice (Keinert et al.) */
const GOLDEN_RATIO = 1.618033988749895;
const PI = 3.141592653589793;

export const sphericalFibonacciNodeSpec: NodeSpec = {
  id: 'spherical-fibonacci',
  category: 'Shapes',
  displayName: 'Sphere Fibonacci',
  description:
    'Maps between sphere direction and spherical Fibonacci lattice index. Outputs index from direction (sf2id), direction from index (id2sf), and nearest lattice point.',
  icon: 'sphere',
  inputs: [
    {
      name: 'direction',
      type: 'vec3',
      label: 'Direction',
      fallbackParameter: 'directionX,directionY,directionZ'
    },
    {
      name: 'index',
      type: 'float',
      label: 'Index',
      fallbackParameter: 'indexInput'
    }
  ],
  outputs: [
    { name: 'index', type: 'float', label: 'Index' },
    { name: 'direction', type: 'vec3', label: 'Direction' },
    { name: 'nearestPoint', type: 'vec3', label: 'Nearest' }
  ],
  parameters: {
    latticeCount: {
      type: 'int',
      default: 256,
      min: 4,
      max: 4096,
      step: 1,
      label: 'Lattice count'
    },
    directionX: {
      type: 'float',
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      label: 'Dir X',
      inputMode: 'override'
    },
    directionY: {
      type: 'float',
      default: 0,
      min: -1,
      max: 1,
      step: 0.01,
      label: 'Dir Y',
      inputMode: 'override'
    },
    directionZ: {
      type: 'float',
      default: 1,
      min: -1,
      max: 1,
      step: 0.01,
      label: 'Dir Z',
      inputMode: 'override'
    },
    indexInput: {
      type: 'float',
      default: 0,
      min: 0,
      max: 4095,
      step: 1,
      label: 'Index',
      inputMode: 'override'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['latticeCount', 'indexInput'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Direction (when unconnected)',
        parameters: ['directionX', 'directionY', 'directionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
const float SF_GOLDEN = ${GOLDEN_RATIO};
const float SF_PI = ${PI};

// Index to sphere direction (id2sf). i in [0, n-1], n >= 2.
vec3 sphericalFibonacciId2Sf(float i, float n) {
  float nf = max(n, 2.0);
  float z = 1.0 - (2.0 * i + 1.0) / nf;
  z = clamp(z, -1.0, 1.0);
  float phi = 2.0 * SF_PI * mod(i / SF_GOLDEN, 1.0);
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(phi), r * sin(phi), z);
}

// Direction (unit) to nearest lattice index (sf2id). Returns float index in [0, n-1].
// Fixed loop bound for WebGL2; check up to 5 candidates around the continuous estimate.
float sphericalFibonacciSf2Id(vec3 dir, float n) {
  float nf = max(n, 2.0);
  vec3 d = length(dir) > 0.001 ? normalize(dir) : vec3(0.0, 0.0, 1.0);
  float z = clamp(d.z, -1.0, 1.0);
  float iCont = (1.0 - z) * nf * 0.5 - 0.5;
  int iCenter = int(round(iCont));
  float bestDot = -2.0;
  float bestI = 0.0;
  for (int o = -2; o <= 2; o++) {
    int k = iCenter + o;
    if (k < 0) continue;
    float ik = float(k);
    if (ik >= nf) break;
    float dotK = dot(d, sphericalFibonacciId2Sf(ik, nf));
    if (dotK > bestDot) {
      bestDot = dotK;
      bestI = ik;
    }
  }
  return bestI;
}
`,
  mainCode: `
  float n = max(float($param.latticeCount), 2.0);
  n = min(n, 4096.0);

  vec3 dirIn = $input.direction;
  if (length(dirIn) < 0.001) {
    dirIn = vec3($param.directionX, $param.directionY, $param.directionZ);
  }
  dirIn = normalize(dirIn);

  float idxIn = floor(clamp($input.index, 0.0, n - 1.0));

  float outIdx = sphericalFibonacciSf2Id(dirIn, n);
  vec3 outDir = sphericalFibonacciId2Sf(idxIn, n);
  vec3 outNearest = sphericalFibonacciId2Sf(round(outIdx), n);

  $output.index = outIdx;
  $output.direction = outDir;
  $output.nearestPoint = outNearest;
`
};
