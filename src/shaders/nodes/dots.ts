import type { NodeSpec } from '../../types/nodeSpec';

export const dotsNodeSpec: NodeSpec = {
  id: 'dots',
  category: 'Patterns',
  displayName: 'Dots',
  description: 'Polka-dot grid pattern with configurable spacing, dot size, and falloff',
  icon: 'dots',
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
      label: 'Value'
    }
  ],
  parameters: {
    dotsSpacing: {
      type: 'float',
      default: 0.1,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: 'Spacing'
    },
    dotsSize: {
      type: 'float',
      default: 0.03,
      min: 0.001,
      max: 1.0,
      step: 0.001,
      label: 'Dot Size'
    },
    dotsFalloff: {
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Falloff'
    },
    dotsIntensity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Intensity'
    }
  },
  functions: `
float dotsPattern(vec2 p, float spacing, float dotRadiusWorld, float falloff) {
  vec2 cell = fract(p / spacing);
  vec2 center = vec2(0.5, 0.5);
  float dist = length(cell - center);
  // Dot radius in world units, converted to cell space so spacing only affects grid density
  float radius = min(0.5, dotRadiusWorld / spacing);
  return 1.0 - smoothstep(radius, radius + falloff, dist);
}
`,
  mainCode: `
  float dotVal = dotsPattern(
    $input.in,
    $param.dotsSpacing,
    $param.dotsSize,
    $param.dotsFalloff
  );
  $output.out += dotVal * $param.dotsIntensity;
`
};
