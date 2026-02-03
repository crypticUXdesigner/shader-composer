import type { NodeSpec } from '../../types';

export const spherizeNodeSpec: NodeSpec = {
  id: 'spherize',
  category: 'Distort',
  displayName: 'Spherize',
  icon: 'circle',
  description: 'Map rectangle to hemisphere for a 3D ball / planet effect',
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
    spherizeCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    spherizeCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    spherizeRadius: {
      type: 'float',
      default: 1.0,
      min: 0.01,
      max: 3.0,
      step: 0.01,
      label: 'Radius'
    },
    spherizeStrength: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Strength'
    }
  },
  functions: `
vec2 spherize(vec2 p, vec2 center, float radius, float strength) {
  vec2 d = (p - center) / max(radius, 0.001);
  float r = length(d);
  if (r >= 1.0) return p;
  float r2 = r * r;
  float f = 1.0 - r2;
  float z = sqrt(max(0.0, f));
  float theta = atan(d.y, d.x);
  float phi = atan(z, r);
  float rNew = mix(r, phi * 2.0 / 3.14159, strength);
  vec2 dNew = vec2(cos(theta), sin(theta)) * rNew * radius;
  return center + dNew;
}
`,
  mainCode: `
  vec2 spherizeCenter = vec2($param.spherizeCenterX, $param.spherizeCenterY);
  $output.out = spherize($input.in, spherizeCenter, $param.spherizeRadius, $param.spherizeStrength);
`
};
