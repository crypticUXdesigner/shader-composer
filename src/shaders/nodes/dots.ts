import type { NodeSpec } from '../../types/nodeSpec';

export const dotsNodeSpec: NodeSpec = {
  id: 'dots',
  category: 'Patterns',
  displayName: 'Dot Grid',
  description:
    'Polka-dot grid: spacing is center-to-center cell size (UV); dot size is radius (UV), independent of spacing. Pattern tiles seamlessly.',
  icon: 'noise',
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
      min: 0.001,
      max: 1.0,
      step: 0.005,
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
    dotsFeather: {
      type: 'float',
      default: 0.005,
      min: 0.0,
      max: 0.2,
      step: 0.001,
      label: 'Feather'
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
/* periodUv = center-to-center cell size. dotRadiusWorld is independent of period. */
float dotsPattern(vec2 p, float periodUv, float dotRadiusWorld, float featherUv) {
  float period = max(1e-5, periodUv);
  vec2 cell = fract(p / period);
  vec2 center = vec2(0.5, 0.5);
  float dist = length(cell - center);
  float radiusCell = dotRadiusWorld / period;
  float featherCell = featherUv / period;
  return 1.0 - smoothstep(radiusCell, radiusCell + featherCell, dist);
}
`,
  mainCode: `
  float dotVal = dotsPattern(
    $input.in,
    $param.dotsSpacing,
    $param.dotsSize,
    $param.dotsFeather
  );
  $output.out += dotVal * $param.dotsIntensity;
`
};
