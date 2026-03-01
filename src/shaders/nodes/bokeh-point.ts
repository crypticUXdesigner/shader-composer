import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Bokeh point: soft disc intensity for one 3D point light.
 * Reference: Shadertoy "The Drive Home" (ltfXzj) DistLine + BokehMask —
 * point-line distance then smoothstep for bokeh blur.
 */
export const bokehPointNodeSpec: NodeSpec = {
  id: 'bokeh-point',
  category: 'Shapes',
  displayName: 'Bokeh Point',
  description:
    'Soft bokeh disc intensity for a single 3D point: ray origin, ray direction, and point position. Output 0–1; multiply by light color. Reference: Shadertoy The Drive Home.',
  icon: 'circle-dotted',
  inputs: [
    { name: 'ro', type: 'vec3', label: 'Ray origin' },
    { name: 'rd', type: 'vec3', label: 'Ray direction' },
    { name: 'point', type: 'vec3', label: 'Point' }
  ],
  outputs: [{ name: 'out', type: 'float', label: 'Blur' }],
  parameters: {
    size: {
      type: 'float',
      default: 0.05,
      min: 0.001,
      max: 0.5,
      step: 0.001,
      label: 'Size'
    },
    blur: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Blur'
    },
    highQuality: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'Inner falloff'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['size', 'blur', 'highQuality'],
        layout: { columns: 3 }
      }
    ]
  },
  mainCode: `
  float d = length(cross($input.point - $input.ro, $input.rd));
  float sz = max($param.size, 0.0001);
  float m = smoothstep(sz, sz * (1.0 - clamp($param.blur, 0.0, 0.99)), d);
  if ($param.highQuality > 0) {
    m *= mix(0.7, 1.0, smoothstep(0.8 * sz, sz, d));
  }
  $output.out = m;
`
};
