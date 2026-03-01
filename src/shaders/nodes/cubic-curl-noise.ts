import type { NodeSpec } from '../../types/nodeSpec';

export const cubicCurlNoiseNodeSpec: NodeSpec = {
  id: 'cubic-curl-noise',
  category: 'Patterns',
  displayName: 'Curl Noise',
  description: 'Curl noise (flow magnitude) from a cubic-interpolation potential. Produces flow-like, organic patterns for displacement or masking.',
  icon: 'curly-loop',
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
    cubicCurlScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Scale'
    },
    cubicCurlTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    cubicCurlTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
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
      label: 'Curl',
      parameters: ['cubicCurlScale', 'cubicCurlIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'cubic-curl-animation',
      label: 'Animation',
      parameters: ['cubicCurlTimeSpeed', 'cubicCurlTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    },
  ],
  parameterLayout: {
    minColumns: 2,
    elements: [
      {
        type: 'grid',
        parameters: ['cubicCurlScale', 'cubicCurlIntensity'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['cubicCurlTimeSpeed', 'cubicCurlTimeOffset'],
        layout: { columns: 2 }
      }
    ]
  },
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
  float cubicCurlTime = ($time + $param.cubicCurlTimeOffset) * $param.cubicCurlTimeSpeed;
  float result = cubicCurlCurlMagnitude(uv, cubicCurlTime, $param.cubicCurlScale);
  result = result * 0.5 + 0.5;
  $output.out += result * $param.cubicCurlIntensity;
`
};
