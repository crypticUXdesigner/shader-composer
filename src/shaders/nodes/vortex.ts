import type { NodeSpec } from '../../types';

export const vortexNodeSpec: NodeSpec = {
  id: 'vortex',
  category: 'Distort',
  displayName: 'Vortex',
  icon: 'spiral',
  description: 'Spiral pull toward center; points rotate and move inward for drain/portal effects',
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
    vortexCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    vortexCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    vortexStrength: {
      type: 'float',
      default: 1.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Strength'
    },
    vortexRadius: {
      type: 'float',
      default: 1.5,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Radius'
    },
    vortexFalloff: {
      type: 'float',
      default: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: 'Falloff'
    },
    vortexTimeSpeed: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    }
  },
  parameterGroups: [
    {
      id: 'vortex-main',
      label: 'Vortex',
      parameters: ['vortexCenterX', 'vortexCenterY', 'vortexStrength', 'vortexRadius', 'vortexFalloff'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'vortex-animation',
      label: 'Animation',
      parameters: ['vortexTimeSpeed'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  functions: `
vec2 vortex(vec2 p, vec2 center, float strength, float radius, float falloff, float time) {
  vec2 d = p - center;
  float dist = length(d);
  if (dist < 0.0001) return p;
  float n = dist / max(radius, 0.001);
  float f = pow(1.0 - smoothstep(0.0, 1.0, n), falloff);
  float angle = atan(d.y, d.x);
  angle += strength * f + time;
  float r = dist * (1.0 - 0.3 * f * abs(strength));
  return center + vec2(cos(angle), sin(angle)) * r;
}
`,
  mainCode: `
  vec2 vortexCenter = vec2($param.vortexCenterX, $param.vortexCenterY);
  float vortexTime = $time * $param.vortexTimeSpeed;
  $output.out = vortex($input.in, vortexCenter, $param.vortexStrength, $param.vortexRadius, $param.vortexFalloff, vortexTime);
`
};
