import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Orbit camera: outputs ray origin (ro) and ray direction (rd) for 3D raymarching,
 * driven by time and optional inclination. Consumable by box-torus-sdf, generic-raymarcher,
 * and similar nodes that expose ro/rd inputs (not standalone Raymarch Sphere, which uses fixed UV rays).
 *
 * Note on FOV vs Look-at Camera's Zoom: orbit-camera uses a screen-spread multiplier
 * (higher = wider field) while look-at-camera uses an image-plane distance (higher = narrower).
 * The label/center hint reflects 1.0 as the "neutral" value here.
 */
export const orbitCameraNodeSpec: NodeSpec = {
  id: 'orbit-camera',
  category: 'Inputs',
  displayName: 'Orbit Camera',
  description:
    'Camera orbiting a target — outputs ro/rd for 3D SDF / raymarch nodes. Connect Screen position (e.g. UV Coords) so each pixel gets the correct ray; without it every pixel shoots the same forward ray and the scene collapses to a single dot.',
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
      min: -3.0,
      max: 3.0,
      step: 0.05,
      label: 'Speed',
      knobPolarity: 'two-sided'
    },
    phase: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Phase',
      knobPolarity: 'two-sided'
    },
    targetX: {
      type: 'float',
      default: 0.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Target X',
      knobPolarity: 'two-sided'
    },
    targetY: {
      type: 'float',
      default: 0.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Target Y',
      knobPolarity: 'two-sided'
    },
    targetZ: {
      type: 'float',
      default: 0.0,
      min: -20.0,
      max: 20.0,
      step: 0.1,
      label: 'Target Z',
      knobPolarity: 'two-sided'
    },
    inclination: {
      type: 'float',
      default: 0.0,
      min: -1.57,
      max: 1.57,
      step: 0.05,
      label: 'Tilt (rad)',
      knobPolarity: 'two-sided'
    },
    fovScale: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.05,
      label: 'FOV',
      knobCenter: 1.0,
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'orbit',
      label: 'Orbit',
      parameters: ['orbitRadius', 'orbitSpeed', 'phase'],
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
      id: 'view',
      label: 'View',
      parameters: ['inclination', 'fovScale'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Orbit',
        parameters: ['orbitRadius', 'orbitSpeed', 'phase'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Target',
        parameters: ['targetX', 'targetY', 'targetZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'View',
        parameters: ['inclination', 'fovScale'],
        layout: { columns: 2 }
      }
    ]
  },
  mainCode: `
  vec3 target = vec3($param.targetX, $param.targetY, $param.targetZ);
  float angle = $time * $param.orbitSpeed + radians($param.phase);
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
