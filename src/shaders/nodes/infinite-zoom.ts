import type { NodeSpec } from '../../types/nodeSpec';



export const infiniteZoomNodeSpec: NodeSpec = {

  id: 'infinite-zoom',

  category: 'Distort',

  displayName: 'Infinite Zoom',

  icon: 'zoom-in',

  description:

    'Smooth looping UV zoom into a folded tunnel: one Cycle control sets duration; Depth and Zoom step tune intensity without oversensitive scaling. Motion can ping-pong each cycle or ramp one way (zoom in or out) then snap back.',

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

      type: 'vec2',

      label: 'UV'

    }

  ],

  parameters: {

    infiniteZoomMotion: {

      type: 'int',

      default: 0,

      min: 0,

      max: 2,

      step: 1,

      label: 'Motion',

    },

    infiniteZoomCenterX: {

      type: 'float',

      default: 0.0,

      min: -2.0,

      max: 2.0,

      step: 0.1,

      label: 'Center X',

      knobPolarity: 'two-sided' },

    infiniteZoomCenterY: {

      type: 'float',

      default: 0.0,

      min: -2.0,

      max: 2.0,

      step: 0.1,

      label: 'Center Y',

      knobPolarity: 'two-sided' },

    infiniteZoomLoopPeriod: {

      type: 'float',

      default: 10.0,

      min: 0.2,

      max: 120.0,

      step: 0.1,

      label: 'Cycle length'

    },

    infiniteZoomStep: {

      type: 'float',

      default: 1.06,

      min: 1.015,

      max: 1.18,

      step: 0.0025,

      label: 'Zoom step'

    },

    infiniteZoomDepth: {

      type: 'float',

      default: 0.65,

      min: 0.15,

      max: 1.0,

      step: 0.01,

      label: 'Depth'

    }

  },

  parameterLayout: {

    elements: [

      {

        type: 'grid',

        parameters: [

          'infiniteZoomMotion',

          'infiniteZoomCenterX',

          'infiniteZoomCenterY',

          'infiniteZoomLoopPeriod',

          'infiniteZoomStep',

          'infiniteZoomDepth'

        ],

        parameterUI: {
          infiniteZoomMotion: 'enum',
          infiniteZoomCenterX: 'coords',
          infiniteZoomCenterY: 'coords',
        },

        layout: {
          columns: 2,
          coordsSpan: 2,
          parameterSpan: { infiniteZoomMotion: 2, infiniteZoomDepth: 2 },
        }

      }

    ]

  },

  mainCode: `

  vec2 center = vec2($param.infiniteZoomCenterX, $param.infiniteZoomCenterY);

  vec2 p = $input.in - center;

  float step = max($param.infiniteZoomStep, 1.016);

  float depth = clamp($param.infiniteZoomDepth, 0.01, 1.0);

  float cycle = max($param.infiniteZoomLoopPeriod, 0.2);

  float omega = $time * (6.28318530718 / cycle);

  float maxTeFull = 85.0 / log(step);

  float maxTeCap = min(maxTeFull, 18.0);

  float tePeak = depth * maxTeCap;

  float phase = fract($time / cycle);

  float te;

  if ($param.infiniteZoomMotion == 0) {

    te = tePeak * 0.5 * (1.0 - cos(omega));

  } else if ($param.infiniteZoomMotion == 1) {

    te = phase * tePeak;

  } else {

    te = (1.0 - phase) * tePeak;

  }

  float s = pow(step, te);

  p *= s;

  p = fract(p * 0.5 + 0.5) * 2.0 - 1.0;

  $output.out = center + p;

`

};

