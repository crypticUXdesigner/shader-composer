import type { NodeSpec } from '../../types/nodeSpec';

export const radialRaysNodeSpec: NodeSpec = {
  id: 'radial-rays',
  category: 'Patterns',
  displayName: 'Radial Rays',
  description: 'N rays emanating from a center point; count, spread, width, and falloff',
  icon: 'topology-star-ring',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Position'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Rays'
    }
  ],
  parameters: {
    centerX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center X'
    },
    centerY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Center Y'
    },
    rayCount: {
      type: 'int',
      default: 12,
      min: 2,
      max: 64,
      step: 1,
      label: 'Ray Count'
    },
    spreadAngle: {
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
    falloff: {
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Falloff'
    },
    rotation: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Rotation'
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
      id: 'radial-rays',
      label: 'Rays',
      parameters: ['rayCount', 'spreadAngle', 'width', 'falloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'radial-position',
      label: 'Position',
      parameters: ['centerX', 'centerY', 'rotation'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'radial-output',
      label: 'Output',
      parameters: ['intensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['centerX', 'centerY', 'rayCount', 'spreadAngle', 'width', 'falloff', 'rotation', 'intensity'],
        parameterUI: { centerX: 'coords', centerY: 'coords' },
        layout: { columns: 2, coordsSpan: 2 }
      }
    ]
  },
  functions: `
float radialRays(vec2 p, vec2 center, int rayCount, float spreadDeg, float width, float falloff, float rotationDeg) {
  vec2 d = p - center;
  float angle = atan(d.y, d.x) + rotationDeg * 0.017453292519943295;
  float angleNorm = mod(angle + 3.141592653589793, 6.283185307179586) / 6.283185307179586;
  float spreadNorm = spreadDeg / 360.0;
  if (angleNorm > spreadNorm) return 0.0;
  float t = fract(angleNorm / max(spreadNorm, 0.001) * float(rayCount));
  float distFromCenter = min(t, 1.0 - t) * 2.0;
  float ray = 1.0 - smoothstep(width, width + falloff, distFromCenter);
  return ray;
}
`,
  mainCode: `
  vec2 center = vec2($param.centerX, $param.centerY);
  float ray = radialRays($input.in, center, $param.rayCount, $param.spreadAngle, $param.width, $param.falloff, $param.rotation);
  $output.out += ray * $param.intensity;
`
};
