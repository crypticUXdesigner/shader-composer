import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Color system primitives: OKLCH color, Bezier curve, Bayer dither
 */

export const oklchColorNodeSpec: NodeSpec = {
  id: 'oklch-color',
  category: 'Inputs',
  displayName: 'OKLCH Color',
  description: 'Defines an OKLCH color value',
  icon: 'color-picker',
  inputs: [],
  outputs: [
    { name: 'out', type: 'vec3', label: 'Color' }
  ],
  parameters: {
    l: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Lightness'
    },
    c: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 0.4,
      step: 0.01,
      label: 'Chroma'
    },
    h: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      step: 1.0,
      label: 'Hue'
    }
  },
  parameterLayout: {
    elements: [
      { type: 'color-picker', parameters: ['l', 'c', 'h'] }
    ]
  },
  mainCode: `
    $output.out = vec3($param.l, $param.c, $param.h);
  `
};

export const bezierCurveNodeSpec: NodeSpec = {
  id: 'bezier-curve',
  category: 'Inputs',
  displayName: 'Bezier',
  description: 'Defines a cubic bezier curve for color interpolation',
  icon: 'ease-in-out-control-points',
  inputs: [],
  outputs: [
    { name: 'out', type: 'vec4', label: 'Color' }
  ],
  parameters: {
    x1: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Start X'
    },
    y1: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Start Y'
    },
    x2: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'End X'
    },
    y2: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'End Y'
    }
  },
  parameterLayout: {
    elements: [
      {
        type: 'bezier-editor',
        height: 200,
        parameters: ['x1', 'y1', 'x2', 'y2']
      }
    ]
  },
  mainCode: `
    $output.out = vec4($param.x1, $param.y1, $param.x2, $param.y2);
  `
};

export const bayerDitherNodeSpec: NodeSpec = {
  id: 'bayer-dither',
  category: 'Effects',
  displayName: 'Bayer Dither',
  description: 'Applies Bayer dithering to a float value using fragment coordinates',
  icon: 'grain',
  inputs: [
    { name: 'in', type: 'float', label: 'Value' },
    { name: 'fragCoord', type: 'vec2', label: 'Frag coords' },
    { name: 'resolution', type: 'vec2', label: 'Resolution' }
  ],
  outputs: [
    { name: 'out', type: 'float', label: 'Value' }
  ],
  parameters: {
    strength: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 10.0,
      step: 0.01,
      label: 'Strength'
    },
    pixelSize: {
      type: 'float',
      default: 1.0,
      min: 0,
      max: 10.0,
      step: 0.5,
      label: 'Pixel Size'
    }
  },
  functions: `
    float Bayer2(vec2 a) {
      a = floor(a);
      return fract(a.x / 2. + a.y * a.y * .75);
    }
    
    float Bayer4(vec2 a) {
      return Bayer2(.5*(a))*0.25 + Bayer2(a);
    }
    
    float Bayer8(vec2 a) {
      return Bayer4(.5*(a))*0.25 + Bayer2(a);
    }
  `,
  mainCode: `
    vec2 fragCoordCentered = $input.fragCoord - $input.resolution * 0.5;
    float bayer = (Bayer8(fragCoordCentered / $param.pixelSize) - 0.5) * $param.strength;
    $output.out = clamp($input.in + bayer, 0.0, 1.0);
  `
};
