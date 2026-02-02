import type { NodeSpec } from '../../types';

export const crepuscularRaysNodeSpec: NodeSpec = {
  id: 'crepuscular-rays',
  category: 'Patterns',
  displayName: 'Crepuscular Rays',
  description: 'Atmospheric rays from a source point with distance falloff',
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
    sourceX: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Source X'
    },
    sourceY: {
      type: 'float',
      default: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Source Y'
    },
    rayCount: {
      type: 'int',
      default: 12,
      min: 2,
      max: 64,
      step: 1,
      label: 'Ray Count'
    },
    spread: {
      type: 'float',
      default: 360.0,
      min: 1.0,
      max: 360.0,
      step: 1.0,
      label: 'Spread'
    },
    width: {
      type: 'float',
      default: 0.08,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: 'Width'
    },
    distanceFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    },
    intensity: {
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
      id: 'crepuscular-source',
      label: 'Source',
      parameters: ['sourceX', 'sourceY'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'crepuscular-rays',
      label: 'Rays',
      parameters: ['rayCount', 'spread', 'width'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'crepuscular-falloff',
      label: 'Falloff',
      parameters: ['distanceFalloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'crepuscular-output',
      label: 'Output',
      parameters: ['intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
float crepuscularRays(vec2 p, vec2 source, int rayCount, float spreadDeg, float width, float distanceFalloff) {
  vec2 d = p - source;
  float dist = length(d);
  float angle = atan(d.y, d.x);
  float angleNorm = mod(angle + 3.141592653589793, 6.283185307179586) / 6.283185307179586;
  float spreadNorm = spreadDeg / 360.0;
  if (angleNorm > spreadNorm) return 0.0;
  float t = fract(angleNorm / max(spreadNorm, 0.001) * float(rayCount));
  float distFromCenter = min(t, 1.0 - t) * 2.0;
  float ray = 1.0 - smoothstep(width, width + 0.05, distFromCenter);
  float falloff = 1.0 / (1.0 + dist * distanceFalloff);
  return ray * falloff;
}
`,
  mainCode: `
  vec2 source = vec2($param.sourceX, $param.sourceY);
  float ray = crepuscularRays($input.in, source, $param.rayCount, $param.spread, $param.width, $param.distanceFalloff);
  $output.out += ray * $param.intensity;
`
};
