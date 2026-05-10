import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Atmospheric "god rays" / crepuscular rays node.
 *
 * Behavior:
 * - WebGL (single fragment): treats the input as a luminance source and overlays a procedural
 *   radial ray pattern emitted from a configurable source point. The rays are modulated by the
 *   input's luminance so the result reads as light shafts piercing the upstream content.
 * - WebGPU: the compiler emits {@link CompilationResult.webgpuPassPlan} kind
 *   `pass.crepuscular-rays.v1` (multi-pass: input → occluder mask → radial sweep → combine).
 *   See `src/shaders/compilation/crepuscularRaysV1Wgsl.ts` and
 *   `src/runtime/renderBackends/crepuscularRaysPassPlanRuntime.ts`.
 *
 * Ports are vec4-in / vec4-out so the node slots into post-effect chains
 * (`... → crepuscular-rays → final-output`) consistently with `blur` and `glow-bloom`.
 */
export const crepuscularRaysNodeSpec: NodeSpec = {
  id: 'crepuscular-rays',
  category: 'Effects',
  displayName: 'Crepuscular Rays',
  description: 'Atmospheric god rays radiating from a source point with distance falloff',
  icon: 'sunrise',
  inputs: [
    {
      name: 'in',
      type: 'vec4',
      label: 'Color'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4',
      label: 'Color'
    }
  ],
  parameters: {
    sourceX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Source X',
      knobPolarity: 'two-sided' },
    sourceY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Source Y',
      knobPolarity: 'two-sided' },
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
    },
    rotationSpeed: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.01,
      label: 'Rotation Speed',
      knobPolarity: 'two-sided' },
    rotationOffset: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Rotation Offset'
    }
  },
  parameterGroups: [
    {
      id: 'crepuscular-source',
      label: 'Source',
      parameters: ['sourceX', 'sourceY', 'distanceFalloff'],
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
      id: 'crepuscular-animation',
      label: 'Motion & Intensity',
      parameters: ['intensity', 'rotationSpeed', 'rotationOffset'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: [
          'sourceX',
          'sourceY',
          'distanceFalloff',
          'rayCount',
          'spread',
          'width',
          'intensity',
          'rotationSpeed',
          'rotationOffset'
        ],
        parameterUI: { sourceX: 'coords', sourceY: 'coords' },
        layout: { columns: 3, coordsSpan: 2 }
      }
    ]
  },
  functions: `
float crepuscularRayPattern(vec2 uv, vec2 source, int rayCount, float spreadDeg, float width, float distanceFalloff, float angleOffset) {
  vec2 d = uv - source;
  float dist = length(d);
  float angle = atan(d.y, d.x) + angleOffset;
  float angleNorm = mod(angle + 3.141592653589793, 6.283185307179586) / 6.283185307179586;
  float spreadNorm = clamp(spreadDeg / 360.0, 0.001, 1.0);
  if (angleNorm > spreadNorm) return 0.0;
  float t = fract(angleNorm / spreadNorm * float(rayCount));
  float distFromCenter = min(t, 1.0 - t) * 2.0;
  float ray = 1.0 - smoothstep(width, width + 0.05, distFromCenter);
  float falloff = 1.0 / (1.0 + dist * distanceFalloff);
  return ray * falloff;
}
`,
  mainCode: `
  vec2 cr_source = vec2(0.5) + 0.5 * vec2($param.sourceX, $param.sourceY);
  float cr_angleOffset = ($param.rotationOffset + uTime * $param.rotationSpeed) * 6.283185307179586;
  float cr_ray = crepuscularRayPattern(uv, cr_source, $param.rayCount, $param.spread, $param.width, $param.distanceFalloff, cr_angleOffset);
  vec3 cr_srcRgb = $input.in.rgb;
  float cr_luma = dot(cr_srcRgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 cr_lightShaft = cr_srcRgb * cr_ray * cr_luma * $param.intensity;
  $output.out = vec4(cr_srcRgb + cr_lightShaft, $input.in.a);
`
};
