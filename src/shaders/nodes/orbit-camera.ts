import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Orbit camera: outputs ray origin (ro) and ray direction (rd) for 3D raymarching,
 * driven by time and optional inclination. Consumable by box-torus-sdf, sphere-raymarch,
 * and future glass shell / raymarch nodes.
 */
export const orbitCameraNodeSpec: NodeSpec = {
  id: 'orbit-camera',
  category: 'Inputs',
  displayName: 'Orbit Camera',
  description: 'Outputs ray origin (ro) and ray direction (rd) from a time-driven orbit around a target for 3D raymarching',
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
    orbitRadius: {
      type: 'float',
      default: 3.0,
      min: 0.5,
      max: 20.0,
      step: 0.1,
      label: 'Radius'
    },
    orbitSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 3.0,
      step: 0.05,
      label: 'Speed'
    },
    targetX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Target X'
    },
    targetY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Target Y'
    },
    targetZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Target Z'
    },
    inclination: {
      type: 'float',
      default: 0.0,
      min: -1.57,
      max: 1.57,
      step: 0.05,
      label: 'Inclination'
    },
    fovScale: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.05,
      label: 'FOV'
    }
  },
  parameterGroups: [
    {
      id: 'orbit',
      label: 'Orbit',
      parameters: ['orbitRadius', 'orbitSpeed'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'target',
      label: 'Target',
      parameters: ['targetX', 'targetY', 'targetZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'tilt',
      label: 'Tilt',
      parameters: ['inclination'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'view',
      label: 'View',
      parameters: ['fovScale'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Orbit',
        parameters: ['orbitRadius', 'orbitSpeed'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Target',
        parameters: ['targetX', 'targetY', 'targetZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Tilt',
        parameters: ['inclination'],
        layout: { columns: 1 }
      },
      {
        type: 'grid',
        label: 'View',
        parameters: ['fovScale'],
        layout: { columns: 1 }
      }
    ]
  },
  mainCode: `
  vec3 target = vec3($param.targetX, $param.targetY, $param.targetZ);
  float angle = $time * $param.orbitSpeed;
  float r = $param.orbitRadius;
  float inc = $param.inclination;
  // Orbit in XZ plane; tilt by inclination (rotate around X)
  vec3 offset = r * vec3(cos(angle), -sin(inc) * sin(angle), cos(inc) * sin(angle));
  vec3 ro = target + offset;
  vec3 forward = normalize(target - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  float fov = $param.fovScale;
  vec3 rd = normalize(forward + ($input.in.x * right + $input.in.y * up) * fov);
  $output.ro = ro;
  $output.rd = rd;
`
};
