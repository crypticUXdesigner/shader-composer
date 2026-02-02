import type { NodeSpec } from '../../types';

export const volumeRaysNodeSpec: NodeSpec = {
  id: 'volume-rays',
  category: 'Patterns',
  displayName: 'Volume Rays',
  description: 'Accumulates glow/density along the view ray using raymarching and 3D noise',
  icon: 'glow',
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
    volumeSteps: {
      type: 'int',
      default: 32,
      min: 8,
      max: 128,
      step: 1,
      label: 'Steps'
    },
    volumeStepSize: {
      type: 'float',
      default: 0.08,
      min: 0.01,
      max: 0.3,
      step: 0.01,
      label: 'Step Size'
    },
    volumeDensityScale: {
      type: 'float',
      default: 2.0,
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: 'Density Scale'
    },
    volumeIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'raymarch',
      label: 'Raymarch',
      parameters: ['volumeSteps', 'volumeStepSize'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'volume',
      label: 'Volume',
      parameters: ['volumeDensityScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'output',
      label: 'Output',
      parameters: ['volumeIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float hash11(float n) {
  return fract(sin(n) * 43758.5453);
}

float vnoise3(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp * fp * (3.0 - 2.0 * fp);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0 = mix(x00, x10, w.y);
  float y1 = mix(x01, x11, w.y);
  return mix(y0, y1, w.z);
}
`,
  mainCode: `
  vec3 ro = vec3(0.0, 0.0, 3.0);
  vec3 rd = normalize(vec3($input.in, -1.0));
  float stepSize = $param.volumeStepSize;
  float densityScale = $param.volumeDensityScale;
  int steps = int(clamp(float($param.volumeSteps), 8.0, 128.0));
  float acc = 0.0;
  float z = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    vec3 pos = ro + z * rd;
    float dens = vnoise3(pos * densityScale + vec3(0.0, 0.0, $time * 0.2)) * 0.5 + 0.5;
    acc += dens * stepSize;
    z += stepSize;
    if (z > 20.0) break;
  }
  float norm = clamp(acc * 0.15, 0.0, 1.0);
  $output.out += norm * $param.volumeIntensity;
`
};
