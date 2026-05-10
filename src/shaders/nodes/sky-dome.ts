import type { NodeSpec } from '../../types/nodeSpec';

/**
 * OKLCH defaults reproduce the legacy RGB defaults
 * (zenith (0.15, 0.25, 0.55), horizon (0.7, 0.75, 0.9)) so visual parity
 * is preserved for users created before the OKLCH conversion.
 */
const ZENITH_DEFAULT_L = 0.6319730194386093;
const ZENITH_DEFAULT_C = 0.09501306371808037;
const ZENITH_DEFAULT_H = 263.7791785480358;

const HORIZON_DEFAULT_L = 0.9090784707082283;
const HORIZON_DEFAULT_C = 0.026707862130263414;
const HORIZON_DEFAULT_H = 270.046705472024;

export const skyDomeNodeSpec: NodeSpec = {
  id: 'sky-dome',
  category: 'Shapes',
  displayName: 'Skydome',
  description: 'Procedural sky dome with zenith/horizon gradient and optional sun disc, plus a virtual camera (FOV, yaw, pitch, roll) for backgrounds behind raymarched scenes',
  icon: 'glow',
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
      type: 'vec4',
      label: 'Color'
    }
  ],
  parameters: {
    zenithL: {
      type: 'float',
      default: ZENITH_DEFAULT_L,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Zenith L'
    },
    zenithC: {
      type: 'float',
      default: ZENITH_DEFAULT_C,
      min: 0.0,
      max: 0.4,
      step: 0.001,
      label: 'Zenith C'
    },
    zenithH: {
      type: 'float',
      default: ZENITH_DEFAULT_H,
      min: 0.0,
      max: 360.0,
      step: 0.001,
      label: 'Zenith H'
    },
    horizonL: {
      type: 'float',
      default: HORIZON_DEFAULT_L,
      min: 0.0,
      max: 1.0,
      step: 0.001,
      label: 'Horizon L'
    },
    horizonC: {
      type: 'float',
      default: HORIZON_DEFAULT_C,
      min: 0.0,
      max: 0.4,
      step: 0.001,
      label: 'Horizon C'
    },
    horizonH: {
      type: 'float',
      default: HORIZON_DEFAULT_H,
      min: 0.0,
      max: 360.0,
      step: 0.001,
      label: 'Horizon H'
    },
    horizonSharpness: {
      type: 'float',
      default: 0.5,
      min: 0.01,
      max: 2.0,
      step: 0.01,
      label: 'Horizon Softness'
    },
    sunDirX: {
      type: 'float',
      default: 0.0,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Dir X',
      knobPolarity: 'two-sided' },
    sunDirY: {
      type: 'float',
      default: 0.9,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Dir Y',
      knobPolarity: 'two-sided' },
    sunDirZ: {
      type: 'float',
      default: -0.44,
      min: -1.0,
      max: 1.0,
      step: 0.05,
      label: 'Dir Z',
      knobPolarity: 'two-sided' },
    sunRadius: {
      type: 'float',
      default: 0.02,
      min: 0.001,
      max: 0.5,
      step: 0.001,
      label: 'Radius (rad)'
    },
    sunIntensity: {
      type: 'float',
      default: 1.5,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: 'Strength'
    },
    /**
     * Virtual camera. Default fov=90 reproduces the legacy implicit field of view
     * (uv*2-1 in the ray direction) so existing graphs render unchanged.
     */
    fov: {
      type: 'float',
      default: 90.0,
      min: 10.0,
      max: 150.0,
      step: 1.0,
      label: 'FOV (deg)'
    },
    viewYaw: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Yaw',
      knobPolarity: 'two-sided' },
    viewPitch: {
      type: 'float',
      default: 0.0,
      min: -90.0,
      max: 90.0,
      step: 1.0,
      label: 'Pitch',
      knobPolarity: 'two-sided' },
    viewRoll: {
      type: 'float',
      default: 0.0,
      min: -180.0,
      max: 180.0,
      step: 1.0,
      label: 'Roll',
      knobPolarity: 'two-sided' }
  },
  parameterGroups: [
    {
      id: 'sky-dome-sky',
      label: 'Sky',
      parameters: ['zenithL', 'zenithC', 'zenithH', 'horizonL', 'horizonC', 'horizonH', 'horizonSharpness'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'sky-dome-sun',
      label: 'Sun',
      parameters: ['sunDirX', 'sunDirY', 'sunDirZ', 'sunRadius', 'sunIntensity'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'sky-dome-view',
      label: 'View',
      parameters: ['fov', 'viewYaw', 'viewPitch', 'viewRoll'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    minColumns: 3,
    elements: [
      {
        type: 'color-picker-row',
        label: 'Sky',
        pickers: [
          ['zenithL', 'zenithC', 'zenithH'],
          ['horizonL', 'horizonC', 'horizonH']
        ]
      },
      {
        type: 'grid',
        parameters: [
          'zenithL',
          'zenithC',
          'zenithH',
          'horizonL',
          'horizonC',
          'horizonH',
          'horizonSharpness'
        ],
        parameterUI: {
          zenithL: 'input',
          zenithC: 'input',
          zenithH: 'input',
          horizonL: 'input',
          horizonC: 'input',
          horizonH: 'input'
        },
        layout: { columns: 3, parameterSpan: { horizonSharpness: 3 } }
      },
      {
        type: 'grid',
        label: 'Sun',
        parameters: ['sunDirX', 'sunDirY', 'sunDirZ', 'sunRadius', 'sunIntensity'],
        layout: { columns: 3, parameterSpan: { sunIntensity: 2 } }
      },
      {
        type: 'grid',
        label: 'View',
        parameters: ['fov', 'viewYaw', 'viewPitch', 'viewRoll'],
        parameterUI: { viewYaw: 'coords', viewPitch: 'coords' },
        layout: {
          columns: 3,
          coordsSpan: 3,
          coordsOrigin: { viewYaw: 'center' },
          parameterSpan: { fov: 3, viewRoll: 3 }
        }
      }
    ]
  },
  functions: `
vec3 skyDomeOklchToRgb(vec3 oklch) {
  float l = oklch.x;
  float c = oklch.y;
  float h = oklch.z * 3.14159265359 / 180.0;

  float a = c * cos(h);
  float b = c * sin(h);

  float l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  float m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  float s_ = l - 0.0894841775 * a - 1.2914855480 * b;

  float l3 = l_ * l_ * l_;
  float m3 = m_ * m_ * m_;
  float s3 = s_ * s_ * s_;

  float r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  float g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  float bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  return clamp(vec3(r, g, bl), 0.0, 1.0);
}
`,
  mainCode: `
  // Ray direction from UV with adjustable FOV. fov=90 reproduces the legacy implicit FOV
  // (uv*2-1 with focal length 1.0).
  vec2 uv = $input.in;
  float halfFov = radians($param.fov) * 0.5;
  float t = tan(halfFov);
  vec2 ndc = (uv * 2.0 - 1.0) * t;
  vec3 baseDir = normalize(vec3(ndc, -1.0));

  // Apply view rotation: roll (around Z, camera-space) -> pitch (around X) -> yaw (around Y).
  // Yaw>0 turns the view to the right; pitch>0 tilts up; roll>0 cants the camera clockwise.
  float yawRad = radians($param.viewYaw);
  float pitchRad = radians($param.viewPitch);
  float rollRad = radians($param.viewRoll);
  float cy = cos(yawRad);   float sy = sin(yawRad);
  float cp = cos(pitchRad); float sp = sin(pitchRad);
  float cr = cos(rollRad);  float sr = sin(rollRad);

  vec3 r1 = vec3(cr * baseDir.x - sr * baseDir.y,
                 sr * baseDir.x + cr * baseDir.y,
                 baseDir.z);
  vec3 r2 = vec3(r1.x,
                 cp * r1.y - sp * r1.z,
                 sp * r1.y + cp * r1.z);
  vec3 rayDir = vec3(cy * r2.x - sy * r2.z,
                     r2.y,
                     sy * r2.x + cy * r2.z);

  // Elevation: asin(rayDir.y) in [-PI/2, PI/2]; high = zenith, low = horizon
  float elevation = asin(clamp(rayDir.y, -1.0, 1.0));

  // Blend horizon -> zenith by elevation (softness widens the transition band)
  float edge0 = -0.1 * $param.horizonSharpness;
  float edge1 = 0.5 * $param.horizonSharpness;
  float blendT = smoothstep(edge0, edge1, elevation);

  vec3 zenithColor = skyDomeOklchToRgb(vec3($param.zenithL, $param.zenithC, $param.zenithH));
  vec3 horizonColor = skyDomeOklchToRgb(vec3($param.horizonL, $param.horizonC, $param.horizonH));
  vec3 skyColor = mix(horizonColor, zenithColor, blendT);

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
