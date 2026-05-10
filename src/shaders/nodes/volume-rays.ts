import type { NodeSpec } from '../../types/nodeSpec';

export const volumeRaysNodeSpec: NodeSpec = {
  id: 'volume-rays',
  category: 'Patterns',
  displayName: 'Cloud Fog',
  description: 'Volumetric fog/density mask with raymarched 3D noise, camera controls, falloff, contrast, and drift',
  icon: 'cloud',
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
      label: 'Density'
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
      label: 'Noise Scale'
    },
    volumeThreshold: {
      type: 'float',
      default: 0.42,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Threshold'
    },
    volumeContrast: {
      type: 'float',
      default: 2.5,
      min: 0.25,
      max: 8.0,
      step: 0.05,
      label: 'Contrast'
    },
    volumeFalloff: {
      type: 'float',
      default: 0.12,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Distance Falloff'
    },
    volumeIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.01,
      label: 'Intensity'
    },
    volumeTimeSpeed: {
      type: 'float',
      default: 0.2,
      min: -2.0,
      max: 2.0,
      step: 0.001,
      label: 'Drift Speed',
      knobPolarity: 'two-sided'
    },
    cameraPosX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Camera X',
      knobPolarity: 'two-sided' },
    cameraPosY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Camera Y',
      knobPolarity: 'two-sided' },
    cameraPosZ: {
      type: 'float',
      default: 3.0,
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: 'Camera Z'
    },
    cameraYaw: {
      type: 'float',
      default: 0.0,
      min: -3.14159,
      max: 3.14159,
      step: 0.01,
      label: 'Yaw',
      knobPolarity: 'two-sided' },
    cameraPitch: {
      type: 'float',
      default: 0.0,
      min: -1.57,
      max: 1.57,
      step: 0.01,
      label: 'Pitch',
      knobPolarity: 'two-sided' },
    cameraFovScale: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.05,
      label: 'FOV Scale'
    }
  },
  parameterGroups: [
    {
      id: 'volume-density',
      label: 'Density',
      parameters: ['volumeDensityScale', 'volumeThreshold', 'volumeContrast', 'volumeFalloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'volume-quality',
      label: 'Raymarch',
      parameters: ['volumeSteps', 'volumeStepSize'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'volume-camera',
      label: 'Camera',
      parameters: ['cameraPosX', 'cameraPosY', 'cameraPosZ', 'cameraYaw', 'cameraPitch', 'cameraFovScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'volume-output',
      label: 'Output',
      parameters: ['volumeIntensity', 'volumeTimeSpeed'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    minColumns: 2,
    elements: [
      {
        type: 'grid',
        label: 'Density',
        parameters: ['volumeDensityScale', 'volumeThreshold', 'volumeContrast', 'volumeFalloff'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Raymarch',
        parameters: ['volumeSteps', 'volumeStepSize'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Camera',
        parameters: ['cameraPosX', 'cameraPosY', 'cameraPosZ', 'cameraYaw', 'cameraPitch', 'cameraFovScale'],
        parameterUI: { cameraPosX: 'coords', cameraPosY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      },
      {
        type: 'grid',
        label: 'Output',
        parameters: ['volumeIntensity', 'volumeTimeSpeed'],
        layout: { columns: 2 }
      }
    ]
  },
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

float volumeRaysFbm(vec3 p) {
  float value = 0.0;
  value += 0.55 * vnoise3(p);
  value += 0.30 * vnoise3(p * 2.07 + vec3(17.1, 3.7, 11.3));
  value += 0.15 * vnoise3(p * 4.03 + vec3(5.4, 19.2, 2.8));
  return value;
}
`,
  mainCode: `
  float yaw = $param.cameraYaw;
  float pitch = $param.cameraPitch;
  vec3 forward = vec3(cos(pitch) * sin(yaw), sin(pitch), -cos(pitch) * cos(yaw));
  vec3 right = vec3(cos(yaw), 0.0, sin(yaw));
  vec3 up = vec3(-sin(pitch) * sin(yaw), cos(pitch), sin(pitch) * cos(yaw));
  vec2 uv = $input.in * $param.cameraFovScale;
  vec3 rdCam = normalize(vec3(uv, -1.0));
  vec3 rd = normalize(right * rdCam.x + up * rdCam.y - forward * rdCam.z);
  vec3 ro = vec3($param.cameraPosX, $param.cameraPosY, $param.cameraPosZ);
  float stepSize = $param.volumeStepSize;
  float densityScale = $param.volumeDensityScale;
  float threshold = $param.volumeThreshold;
  float contrast = max($param.volumeContrast, 0.001);
  float falloff = $param.volumeFalloff;
  int steps = int(clamp(float($param.volumeSteps), 8.0, 128.0));
  float acc = 0.0;
  float z = 0.0;
  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    vec3 pos = ro + z * rd;
    vec3 drift = vec3(0.0, 0.0, $time * $param.volumeTimeSpeed);
    float cloud = volumeRaysFbm(pos * densityScale + drift);
    float edgeWidth = max(0.02, 1.0 / contrast);
    float dens = smoothstep(threshold, threshold + edgeWidth, cloud);
    float distanceFade = exp(-z * falloff);
    acc += dens * stepSize * distanceFade;
    z += stepSize;
    if (z > 20.0) break;
  }
  float norm = clamp(1.0 - exp(-acc * 0.75), 0.0, 1.0);
  $output.out += norm * $param.volumeIntensity;
`
};
