import type { NodeSpec } from '../../types';

export const skyDomeNodeSpec: NodeSpec = {
  id: 'sky-dome',
  category: 'Shapes',
  displayName: 'Sky / Dome',
  description: 'Procedural sky dome with zenith/horizon gradient and optional sun disc for backgrounds behind raymarched scenes',
  icon: 'glow',
  inputs: [
    {
      name: 'in',
      type: 'vec2'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4'
    }
  ],
  parameters: {
    zenithR: {
      type: 'float',
      default: 0.15,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Sky R'
    },
    zenithG: {
      type: 'float',
      default: 0.25,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Sky G'
    },
    zenithB: {
      type: 'float',
      default: 0.55,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Sky B'
    },
    horizonR: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Horizon R'
    },
    horizonG: {
      type: 'float',
      default: 0.75,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Horizon G'
    },
    horizonB: {
      type: 'float',
      default: 0.9,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Horizon B'
    },
    horizonSharpness: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Horizon Soft'
    },
    sunDirX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Sun X'
    },
    sunDirY: {
      type: 'float',
      default: 0.9,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Sun Y'
    },
    sunDirZ: {
      type: 'float',
      default: -0.44,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Sun Z'
    },
    sunRadius: {
      type: 'float',
      default: 0.02,
      min: 0.001,
      max: 0.5,
      step: 0.001,
      label: 'Sun Size'
    },
    sunIntensity: {
      type: 'float',
      default: 1.5,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Sun Strength'
    }
  },
  parameterGroups: [
    {
      id: 'sky-dome-sky',
      label: 'Sky',
      parameters: ['zenithR', 'zenithG', 'zenithB', 'horizonR', 'horizonG', 'horizonB', 'horizonSharpness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'sky-dome-sun',
      label: 'Sun',
      parameters: ['sunDirX', 'sunDirY', 'sunDirZ', 'sunRadius', 'sunIntensity'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  mainCode: `
  // Ray direction from UV (orthographic, same convention as sphere-raymarch)
  vec2 uv = $input.in;
  vec3 rayDir = normalize(vec3(uv * 2.0 - 1.0, -1.0));

  // Elevation: asin(rayDir.y) in [-PI/2, PI/2]; high = zenith, low = horizon
  float elevation = asin(clamp(rayDir.y, -1.0, 1.0));

  // Blend horizon -> zenith by elevation (tweak range with horizonSharpness)
  float edge0 = -0.1 * $param.horizonSharpness;
  float edge1 = 0.5 * $param.horizonSharpness;
  float t = smoothstep(edge0, edge1, elevation);

  vec3 zenithColor = vec3($param.zenithR, $param.zenithG, $param.zenithB);
  vec3 horizonColor = vec3($param.horizonR, $param.horizonG, $param.horizonB);
  vec3 skyColor = mix(horizonColor, zenithColor, t);

  // Sun disc: add intensity when ray is within sunRadius of sun direction
  vec3 sunDir = normalize(vec3($param.sunDirX, $param.sunDirY, $param.sunDirZ));
  float angleToSun = acos(clamp(dot(rayDir, sunDir), -1.0, 1.0));
  if (angleToSun < $param.sunRadius) {
    float sunFalloff = 1.0 - smoothstep(0.0, 1.0, angleToSun / $param.sunRadius);
    skyColor += $param.sunIntensity * sunFalloff;
  }

  $output.out = vec4(skyColor, 1.0);
`
};
