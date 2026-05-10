import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Look-at camera: outputs ray origin (ro) and ray direction (rd) from a fixed
 * camera position looking at a target. No orbit; forward view for drive-style
 * or fixed-view 3D. Reference: Shadertoy "The Drive Home" (ltfXzj) CameraSetup.
 */
export const lookAtCameraNodeSpec: NodeSpec = {
  id: 'look-at-camera',
  category: 'Inputs',
  displayName: 'Look-at Camera',
  description:
    'Outputs ray origin (ro) and ray direction (rd) from a fixed camera position looking at a target. Connect screen position (e.g. UV or UV minus rain offset) for perspective. Zoom is distance along the view to the ray image plane (larger → usually narrower field); it is not magnify-style optical zoom.',
  icon: 'focus',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'Screen position'
    }
  ],
  outputs: [
    { name: 'ro', type: 'vec3', label: 'Ray origin' },
    { name: 'rd', type: 'vec3', label: 'Ray direction' }
  ],
  parameters: {
    posX: {
      type: 'float',
      default: 0.3,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Position X',
      knobPolarity: 'two-sided' },
    posY: {
      type: 'float',
      default: 0.15,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Position Y',
      knobPolarity: 'two-sided' },
    posZ: {
      type: 'float',
      default: -3.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Position Z',
      knobPolarity: 'two-sided' },
    lookatX: {
      type: 'float',
      default: 0.3,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Look-at target X',
      knobPolarity: 'two-sided' },
    lookatY: {
      type: 'float',
      default: 0.15,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Look-at target Y',
      knobPolarity: 'two-sided' },
    lookatZ: {
      type: 'float',
      default: 1.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Look-at target Z',
      knobPolarity: 'two-sided' },
    zoom: {
      type: 'float',
      default: 2.0,
      min: 0.2,
      max: 10.0,
      step: 0.1,
      label: 'Zoom'
    }
  },
  parameterGroups: [
    {
      id: 'position',
      label: 'Position',
      parameters: ['posX', 'posY', 'posZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'lookat',
      label: 'Look-at target',
      parameters: ['lookatX', 'lookatY', 'lookatZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'view',
      label: 'View',
      parameters: ['zoom'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Position',
        parameters: ['posX', 'posY', 'posZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Look-at target',
        parameters: ['lookatX', 'lookatY', 'lookatZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'View',
        parameters: ['zoom'],
        layout: { columns: 1 }
      }
    ]
  },
  mainCode: `
  vec3 ro = vec3($param.posX, $param.posY, $param.posZ);
  vec3 lookat = vec3($param.lookatX, $param.lookatY, $param.lookatZ);
  vec3 f = normalize(lookat - ro);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  vec3 center = ro + f * $param.zoom;
  vec3 i = center + $input.in.x * r + $input.in.y * u;
  vec3 rd = normalize(i - ro);
  $output.ro = ro;
  $output.rd = rd;
`
};
