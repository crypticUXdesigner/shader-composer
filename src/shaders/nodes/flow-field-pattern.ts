import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Flow Field Pattern
 * Curl-noise-based 2D flow pattern (vec2 in → float out).
 * Parameter groups: Flow (scale, curlScale, octaves, gain), Output (intensity), Animation (timeSpeed, timeOffset).
 */
export const flowFieldPatternNodeSpec: NodeSpec = {
  id: 'flow-field-pattern',
  category: 'Patterns',
  displayName: 'Flow Field',
  description: 'Curl-noise-based flow pattern producing organic streaks and flow lines',
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
      label: 'Value'
    }
  ],
  parameters: {
    flowScale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 20.0,
      step: 0.01,
      label: 'Scale'
    },
    flowCurlScale: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 5.0,
      step: 0.01,
      label: 'Curl Scale'
    },
    flowTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 20.0,
      step: 0.01,
      label: 'Time Speed'
    },
    flowTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    },
    flowOctaves: {
      type: 'int',
      default: 3,
      min: 1,
      max: 6,
      step: 1,
      label: 'Octaves'
    },
    flowGain: {
      type: 'float',
      default: 0.5,
      min: 0.1,
      max: 1.0,
      step: 0.01,
      label: 'Gain'
    },
    flowIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  parameterLayout: {
    minColumns: 2,
    elements: [
      {
        type: 'grid',
        parameters: ['flowScale', 'flowCurlScale', 'flowOctaves', 'flowGain', 'flowIntensity'],
        layout: { columns: 2, parameterSpan: { flowIntensity: 2 } }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['flowTimeSpeed', 'flowTimeOffset'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
// 1D hash
float flowHash(float n) {
  return fract(sin(n) * 43758.5453);
}
// 3D value noise for curl (z = time)
float flowVnoise(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  fp = fp * fp * (3.0 - 2.0 * fp);

  float n000 = flowHash(dot(ip + vec3(0,0,0), vec3(1.0, 57.0, 113.0)));
  float n100 = flowHash(dot(ip + vec3(1,0,0), vec3(1.0, 57.0, 113.0)));
  float n010 = flowHash(dot(ip + vec3(0,1,0), vec3(1.0, 57.0, 113.0)));
  float n110 = flowHash(dot(ip + vec3(1,1,0), vec3(1.0, 57.0, 113.0)));
  float n001 = flowHash(dot(ip + vec3(0,0,1), vec3(1.0, 57.0, 113.0)));
  float n101 = flowHash(dot(ip + vec3(1,0,1), vec3(1.0, 57.0, 113.0)));
  float n011 = flowHash(dot(ip + vec3(0,1,1), vec3(1.0, 57.0, 113.0)));
  float n111 = flowHash(dot(ip + vec3(1,1,1), vec3(1.0, 57.0, 113.0)));

  float x00 = mix(n000, n100, fp.x);
  float x10 = mix(n010, n110, fp.x);
  float x01 = mix(n001, n101, fp.x);
  float x11 = mix(n011, n111, fp.x);
  float y0 = mix(x00, x10, fp.y);
  float y1 = mix(x01, x11, fp.y);
  return mix(y0, y1, fp.z) * 2.0 - 1.0;
}
// 2D curl: curl F = (dF/dy, -dF/dx); F from 3D noise with time as z
vec2 flowCurl(vec3 p, float eps) {
  float F = flowVnoise(p);
  float Fx = flowVnoise(p + vec3(eps, 0.0, 0.0));
  float Fy = flowVnoise(p + vec3(0.0, eps, 0.0));
  float dFdx = (Fx - F) / eps;
  float dFdy = (Fy - F) / eps;
  return vec2(dFdy, -dFdx);
}
`,
  mainCode: `
  float flowTime = ($time + $param.flowTimeOffset) * $param.flowTimeSpeed;
  float eps = 0.02 * $param.flowCurlScale;
  vec2 uv = $input.in * $param.flowScale;
  vec2 curlSum = vec2(0.0, 0.0);
  float freq = 1.0;
  float amp = 1.0;
  float lacunarity = 2.0;

  for (int i = 0; i < 6; i++) {
    if (i >= $param.flowOctaves) break;
    vec3 p = vec3(uv * freq, flowTime * 0.1 + float(i) * 0.17);
    curlSum += flowCurl(p, eps / freq) * amp;
    freq *= lacunarity;
    amp *= $param.flowGain;
  }

  float flowMag = length(curlSum);
  float value = 0.5 + 0.5 * smoothstep(0.0, 1.5, flowMag);
  $output.out += value * $param.flowIntensity;
`
};
