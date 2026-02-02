import type { NodeSpec } from '../../types';

export const fisheyeNodeSpec: NodeSpec = {
  id: 'fisheye',
  category: 'Distort',
  displayName: 'Fisheye',
  icon: 'circle',
  description: 'Lens-style radial distortion; negative strength = barrel, positive = pincushion',
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
    fisheyeCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    fisheyeCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    fisheyeStrength: {
      type: 'float',
      default: -0.3,
      min: -1.0,
      max: 1.0,
      step: 0.01,
      label: 'Strength'
    },
    fisheyeAspect: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 2.0,
      step: 0.01,
      label: 'Aspect'
    }
  },
  parameterGroups: [
    {
      id: 'fisheye-main',
      label: 'Fisheye',
      parameters: ['fisheyeCenterX', 'fisheyeCenterY', 'fisheyeStrength', 'fisheyeAspect'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  functions: `
vec2 fisheye(vec2 p, vec2 center, float strength, float aspect) {
  vec2 d = (p - center) * vec2(aspect, 1.0);
  float r = length(d);
  if (r < 0.0001) return p;
  float r2 = r * r;
  float rNew = r * (1.0 + strength * r2);
  vec2 dNorm = d / r;
  vec2 dNew = dNorm * rNew / vec2(aspect, 1.0);
  return center + dNew;
}
`,
  mainCode: `
  vec2 fisheyeCenter = vec2($param.fisheyeCenterX, $param.fisheyeCenterY);
  $output.out = fisheye($input.in, fisheyeCenter, $param.fisheyeStrength, $param.fisheyeAspect);
`
};
