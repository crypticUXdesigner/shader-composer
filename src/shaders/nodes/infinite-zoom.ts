import type { NodeSpec } from '../../types';

export const infiniteZoomNodeSpec: NodeSpec = {
  id: 'infinite-zoom',
  category: 'Distort',
  displayName: 'Infinite Zoom',
  icon: 'zoom-in',
  description: 'Scale and phase coordinates for recursive zoom / tunnel effect',
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
    infiniteZoomCenterX: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center X'
    },
    infiniteZoomCenterY: {
      type: 'float',
      default: 0.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: 'Center Y'
    },
    infiniteZoomScale: {
      type: 'float',
      default: 4.0,
      min: 1.01,
      max: 20.0,
      step: 0.1,
      label: 'Scale'
    },
    infiniteZoomTimeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 5.0,
      step: 0.01,
      label: 'Time Speed'
    }
  },
  parameterGroups: [
    {
      id: 'infinite-zoom-main',
      label: 'Infinite Zoom',
      parameters: ['infiniteZoomCenterX', 'infiniteZoomCenterY', 'infiniteZoomScale', 'infiniteZoomTimeSpeed'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  mainCode: `
  vec2 center = vec2($param.infiniteZoomCenterX, $param.infiniteZoomCenterY);
  vec2 p = $input.in - center;
  float t = $time * $param.infiniteZoomTimeSpeed;
  float scale = $param.infiniteZoomScale;
  float s = pow(scale, fract(t));
  p *= s;
  p = fract(p * 0.5 + 0.5) * 2.0 - 1.0;
  $output.out = center + p;
`
};
