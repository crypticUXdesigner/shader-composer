import type { NodeSpec } from '../../types/nodeSpec';

/**
 * 3D Signed FBM Displacement
 * vec3 position (+ time) in → vec3 displacement out.
 * Uses 3D value noise FBM at three offset positions for uncorrelated x,y,z.
 * Reuses semantics of noise.ts value noise (signed -1..1); duplicated with distinct names
 * so both nodes can coexist in the same graph.
 */
export const displacement3dNodeSpec: NodeSpec = {
  id: 'displacement-3d',
  category: 'Distort',
  displayName: 'Displace 3D',
  description:
    'Signed 3D value-noise FBM displacement. Input vec3 position (and optional time via parameters); outputs vec3 displacement to add to position (e.g. for raymarching or SDF distortion). Uses scale, octaves, lacunarity, gain, and amplitude.',
  icon: 'wave-sine',
  inputs: [
    {
      name: 'position',
      type: 'vec3',
      label: 'Position',
      fallbackParameter: 'positionX,positionY,positionZ'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec3',
      label: 'Displacement'
    }
  ],
  parameters: {
    scale: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 10.0,
      step: 0.01,
      label: 'Scale'
    },
    octaves: {
      type: 'int',
      default: 4,
      min: 1,
      max: 10,
      step: 1,
      label: 'Octaves'
    },
    lacunarity: {
      type: 'float',
      default: 2.0,
      min: 1.0,
      max: 4.0,
      step: 0.01,
      label: 'Lacunarity'
    },
    gain: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.01,
      label: 'Gain'
    },
    amplitude: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Amplitude'
    },
    timeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    timeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    positionX: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Pos X',
      inputMode: 'override'
    },
    positionY: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Pos Y',
      inputMode: 'override'
    },
    positionZ: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.1,
      label: 'Pos Z',
      inputMode: 'override'
    }
  },
  parameterGroups: [
    {
      id: 'fbm',
      label: 'FBM',
      parameters: ['scale', 'octaves', 'lacunarity', 'gain', 'amplitude'],
      collapsible: false,
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
      id: 'position',
      label: 'Position (when unconnected)',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['scale', 'octaves', 'lacunarity', 'gain', 'amplitude'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['timeSpeed', 'timeOffset'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Position',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// 3D value noise (signed -1..1), distinct names to avoid collision with noise node
float displacement_hash11(float n) {
  return fract(sin(n) * 43758.5453);
}

float displacement_vnoise(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = displacement_hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = displacement_hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = displacement_hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = displacement_hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = displacement_hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = displacement_hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = displacement_hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = displacement_hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0 = mix(x00, x10, w.y);
  float y1 = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

// Signed 3D FBM at one point
float displacement_fbm_1(vec3 p, int octaves, float lacunarity, float gain) {
  float amp = 1.0;
  float freq = 1.0;
  float sum = 0.0;
  for (int i = 0; i < 10; ++i) {
    if (i >= octaves) break;
    sum += amp * displacement_vnoise(p * freq);
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

// Three offset samples for uncorrelated x,y,z displacement (different seeds to avoid same value)
vec3 displacement_value_fbm_3d(vec3 p, int octaves, float lacunarity, float gain) {
  const vec3 off1 = vec3(17.7, 31.3, 47.1);
  const vec3 off2 = vec3(53.7, 71.2, 89.4);
  const vec3 off3 = vec3(13.1, 27.7, 41.3);
  float nx = displacement_fbm_1(p + off1, octaves, lacunarity, gain);
  float ny = displacement_fbm_1(p + off2, octaves, lacunarity, gain);
  float nz = displacement_fbm_1(p + off3, octaves, lacunarity, gain);
  return vec3(nx, ny, nz);
}
`,
  mainCode: `
  float dispTime = ($time + $param.timeOffset) * $param.timeSpeed;
  vec3 samplePos = $input.position * $param.scale + vec3(0.0, 0.0, dispTime);
  int octaves = int($param.octaves);
  vec3 disp = displacement_value_fbm_3d(samplePos, octaves, $param.lacunarity, $param.gain);
  $output.out = $param.amplitude * disp;
`
};
