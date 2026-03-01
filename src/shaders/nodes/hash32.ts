import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Hash32 node: deterministic vec3 from vec2 (Dave Hoskins style).
 * Reference: https://www.shadertoy.com/view/4djSRW
 */
export const hash32NodeSpec: NodeSpec = {
  id: 'hash32',
  category: 'Utilities',
  displayName: 'Hash32',
  description: 'Maps a vec2 (e.g. cell id or UV) to a deterministic vec3 in [0,1] using a Dave Hoskins–style hash. Useful for per-cell colors and procedural variation.',
  icon: 'hash',
  inputs: [
    { name: 'in', type: 'vec2', label: 'Seed' }
  ],
  outputs: [
    { name: 'out', type: 'vec3', label: 'Color' }
  ],
  parameters: {},
  functions: `
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 19.19);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
`,
  mainCode: `
  $output.out = hash32($input.in);
  `
};
