import type { NodeSpec } from '../../types/nodeSpec';



export const dotsNodeSpec: NodeSpec = {

  id: 'dots',

  category: 'Patterns',

  displayName: 'Dots',

  description:

    'Polka-dot grid: spacing is the gap between dot edges (UV); dot size is radius (UV). Pattern tiles seamlessly.',

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

    dotsGap: {

      type: 'float',

      default: 0.04,

      min: 0.0,

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
/* gap = edge-to-edge distance between adjacent dots (UV). period = 2*r + gap — spacing does not zoom the dot radius. */
float dotsPattern(vec2 p, float gap, float dotRadiusWorld, float featherUv) {
  float g = max(0.0, gap);
  float period = max(1e-5, 2.0 * dotRadiusWorld + g);
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
    $param.dotsGap,
    $param.dotsSize,
    $param.dotsFeather
  );
  $output.out += dotVal * $param.dotsIntensity;
`

};

