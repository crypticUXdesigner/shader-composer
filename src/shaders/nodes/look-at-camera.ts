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
    'Outputs ray origin (ro) and ray direction (rd) from a fixed camera position looking at a target. Connect screen position (e.g. UV or UV minus rain offset) for perspective.',
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
      label: 'Position X'
    },
    posY: {
      type: 'float',
      default: 0.15,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Position Y'
    },
    posZ: {
      type: 'float',
      default: 0.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Position Z'
    },
    lookatX: {
      type: 'float',
      default: 0.3,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Lookat X'
    },
    lookatY: {
      type: 'float',
      default: 0.15,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Lookat Y'
    },
    lookatZ: {
      type: 'float',
      default: 1.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Lookat Z'
    },
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
      label: 'Lookat',
      parameters: ['lookatX', 'lookatY', 'lookatZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'view',
      label: 'View',
      parameters: ['zoom'],
      collapsible: true,
      defaultCollapsed: true
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
        label: 'Lookat',
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
