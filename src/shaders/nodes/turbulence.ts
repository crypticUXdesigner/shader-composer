import type { NodeSpec } from '../../types';

export const turbulenceNodeSpec: NodeSpec = {
  id: 'turbulence',
  category: 'Distort',
  displayName: 'Turbulence',
  icon: 'noise',
  description: 'Applies multi-stage coordinate warping for complex, organic distortions',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec2'
    }
  ],
  parameters: {
    turbulenceScale: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 10.0,
      step: 0.01,
      label: 'Scale'
    },
    turbulenceStrength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.001,
      label: 'Strength'
    },
    turbulenceIterations: {
      type: 'int',
      default: 3,
      min: 1,
      max: 8,
      step: 1,
      label: 'Iterations'
    },
    turbulenceTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    },
    turbulenceTimeOffset: {
      type: 'float',
      default: 0.0,
      min: -100.0,
      max: 100.0,
      step: 0.05,
      label: 'Time Offset'
    }
  },
  parameterGroups: [
    {
      id: 'turbulence-main',
      label: 'Turbulence',
      parameters: ['turbulenceScale', 'turbulenceStrength', 'turbulenceIterations'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'turbulence-animation',
      label: 'Animation',
      parameters: ['turbulenceTimeSpeed', 'turbulenceTimeOffset'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
// Simple noise for turbulence
vec2 noise2D(vec2 p) {
  return vec2(
    fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453),
    fract(sin(dot(p, vec2(12.9898, 78.233) + vec2(1.0))) * 43758.5453)
  );
}

// Domain warping (strength passed from main so param connections are evaluated in correct execution order)
vec2 turbulence(vec2 p, float time, int iterations, float strength) {
  vec2 q = p;
  int iterCount = max(iterations, 1);
  float s = clamp(strength, 0.0, 2.0);
  if (isnan(s) || isinf(s)) s = 0.0; // guard: avoid NaN/Inf propagating to single-color output
  
  for (int i = 0; i < 8; i++) {
    if (i >= iterCount) break;
    
    float scale = pow(2.0, float(i));
    float safeScale = max(scale, 0.001);
    vec2 offset = noise2D(q * safeScale + time * 0.1) * 2.0 - 1.0;
    q += offset * s / safeScale;
  }
  
  return q;
}
`,
  mainCode: `
  float turbulenceTime = ($time + $param.turbulenceTimeOffset) * $param.turbulenceTimeSpeed;
  float turbulenceStrength = clamp($param.turbulenceStrength, 0.0, 2.0);
  $output.out = turbulence($input.in * $param.turbulenceScale, turbulenceTime, $param.turbulenceIterations, turbulenceStrength);
`
};
