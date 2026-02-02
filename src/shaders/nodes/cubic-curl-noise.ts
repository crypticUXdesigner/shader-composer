import type { NodeSpec } from '../../types';

export const cubicCurlNoiseNodeSpec: NodeSpec = {
  id: 'cubic-curl-noise',
  category: 'Patterns',
  displayName: 'Cubic / Curl Noise',
  description: 'Cubic interpolation value noise (smooth) or curl noise (flow magnitude). Alternative to fBm/Simplex for smoother or flow-like patterns.',
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
    cubicCurlNoiseType: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Type'
    },
    cubicCurlScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Scale'
    },
    cubicCurlOctaves: {
      type: 'float',
      default: 4.0,
      min: 1.0,
      max: 10.0,
      step: 1.0,
      label: 'Octaves'
    },
    cubicCurlLacunarity: {
      type: 'float',
      default: 2.0,
      min: 1.0,
      max: 4.0,
      step: 0.01,
      label: 'Lacunarity'
    },
    cubicCurlGain: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.01,
      label: 'Gain'
    },
    cubicCurlTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    cubicCurlIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterGroups: [
    {
      id: 'cubic-curl-noise',
      label: 'Noise',
      parameters: ['cubicCurlNoiseType', 'cubicCurlScale', 'cubicCurlOctaves', 'cubicCurlLacunarity', 'cubicCurlGain'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'cubic-curl-animation',
      label: 'Animation',
      parameters: ['cubicCurlTimeSpeed'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'cubic-curl-output',
      label: 'Output',
      parameters: ['cubicCurlIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
// 1-D hash
float cubicCurlHash11(float n) {
  return fract(sin(n) * 43758.5453);
}

// Quintic interpolation (smooth)
float cubicCurlQuintic(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// 3D value noise with cubic (quintic) interpolation, output [-1,1]
float cubicCurlVnoise3(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  vec3 w = vec3(cubicCurlQuintic(fp.x), cubicCurlQuintic(fp.y), cubicCurlQuintic(fp.z));

  float n000 = cubicCurlHash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0, 57.0, 113.0)));
  float n100 = cubicCurlHash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0, 57.0, 113.0)));
  float n010 = cubicCurlHash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0, 57.0, 113.0)));
  float n110 = cubicCurlHash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0, 57.0, 113.0)));
  float n001 = cubicCurlHash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0, 57.0, 113.0)));
  float n101 = cubicCurlHash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0, 57.0, 113.0)));
  float n011 = cubicCurlHash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0, 57.0, 113.0)));
  float n111 = cubicCurlHash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0, 57.0, 113.0)));

  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0 = mix(x00, x10, w.y);
  float y1 = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

// Cubic FBM: multiple octaves of cubic value noise, output [0,1]
float cubicCurlFbm(vec2 uv, float t, float scale, int octaves, float lacunarity, float gain) {
  vec3 p = vec3(uv * scale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 0.0;
  for (int i = 0; i < 10; ++i) {
    if (i >= octaves) break;
    sum += amp * cubicCurlVnoise3(p * freq);
    freq *= lacunarity;
    amp *= gain;
  }
  return sum * 0.5 + 0.5;
}

// 3D potential for curl (same cubic value noise)
float cubicCurlPotential(vec3 p) {
  return cubicCurlVnoise3(p) + 0.5 * cubicCurlVnoise3(p * 2.0);
}

// Curl magnitude: 2D curl of potential F(x,y,t), curl = (dF/dy, -dF/dx)
float cubicCurlCurlMagnitude(vec2 uv, float t, float scale) {
  float eps = 0.002;
  vec3 p0 = vec3(uv * scale, t);
  float Fyp = cubicCurlPotential(p0 + vec3(0.0, eps, 0.0));
  float Fym = cubicCurlPotential(p0 - vec3(0.0, eps, 0.0));
  float Fxp = cubicCurlPotential(p0 + vec3(eps, 0.0, 0.0));
  float Fxm = cubicCurlPotential(p0 - vec3(eps, 0.0, 0.0));
  float dFdy = (Fyp - Fym) / (2.0 * eps);
  float dFdx = (Fxp - Fxm) / (2.0 * eps);
  vec2 curl = vec2(dFdy, -dFdx);
  return length(curl);
}
`,
  mainCode: `
  float aspectRatio = $resolution.x / $resolution.y;
  vec2 uv = ($input.in - 0.5) * vec2(aspectRatio, 1.0);
  float cubicCurlTime = $time * $param.cubicCurlTimeSpeed;
  int octaves = int($param.cubicCurlOctaves);

  float result;
  if ($param.cubicCurlNoiseType == 0) {
    result = cubicCurlFbm(uv, cubicCurlTime, $param.cubicCurlScale, octaves, $param.cubicCurlLacunarity, $param.cubicCurlGain);
  } else {
    result = cubicCurlCurlMagnitude(uv, cubicCurlTime, $param.cubicCurlScale);
    result = result * 0.5 + 0.5;
  }
  $output.out += result * $param.cubicCurlIntensity;
`
};
