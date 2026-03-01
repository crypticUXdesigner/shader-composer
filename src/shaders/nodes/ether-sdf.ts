import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Ether SDF
 * 3D SDF for the Ether-fork style volumetric blob: time-rotated domain plus
 * radial term and layered-sine field. vec3 position in → float SDF out.
 * Reference: Shadertoy ltfXzj (Ether by nimitz).
 */
export const etherSdfNodeSpec: NodeSpec = {
  id: 'ether-sdf',
  category: 'SDF',
  displayName: 'Ether SDF',
  description:
    '3D SDF for Ether-fork style volumetric blobs: time-based rotations (XZ, XY) and composite distance (radial + layered sine). Connect to Generic SDF Raymarcher as SDF input. Parameters: rotation speeds, scale, wobble speed, sine amplitude.',
  icon: 'waves',
  inputs: [
    {
      name: 'position',
      type: 'vec3',
      label: 'Position'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'Distance'
    }
  ],
  parameters: {
    rotSpeedXZ: {
      type: 'float',
      default: 0.4,
      min: -2.0,
      max: 2.0,
      step: 0.001,
      label: 'Rotate XZ',
      supportsAnimation: true,
      supportsAudio: true
    },
    rotSpeedXY: {
      type: 'float',
      default: 0.3,
      min: -2.0,
      max: 2.0,
      step: 0.001,
      label: 'Rotate XY',
      supportsAnimation: true,
      supportsAudio: true
    },
    scale: {
      type: 'float',
      default: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.001,
      label: 'Scale',
      supportsAnimation: true,
      supportsAudio: true
    },
    timeSpeed: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 4.0,
      step: 0.001,
      label: 'Time Speed',
      supportsAnimation: true,
      supportsAudio: true
    },
    timeOffset: {
      type: 'float',
      default: 0.0,
      min: -10.0,
      max: 10.0,
      step: 0.001,
      label: 'Time Offset',
      supportsAnimation: true,
      supportsAudio: true
    },
    wobbleSpeed: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 3.0,
      step: 0.001,
      label: 'Wobble Speed',
      supportsAnimation: true,
      supportsAudio: true
    },
    sineAmp: {
      type: 'float',
      default: 5.5,
      min: 0.0,
      max: 20.0,
      step: 0.001,
      label: 'Sine Amp',
      supportsAnimation: true,
      supportsAudio: true
    },
    breatheAmount: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 5.0,
      step: 0.001,
      label: 'Breathe Amount',
      supportsAnimation: true,
      supportsAudio: true
    },
    breatheSpeed: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 4.0,
      step: 0.001,
      label: 'Breathe Speed',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.001,
      label: 'Pos X',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.001,
      label: 'Pos Y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.001,
      label: 'Pos Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true
    }
  },
  parameterGroups: [
    {
      id: 'main',
      label: '',
      parameters: ['rotSpeedXZ', 'rotSpeedXY', 'scale', 'wobbleSpeed', 'sineAmp'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'position',
      label: 'Position',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'animation',
      label: 'Animation',
      parameters: ['timeSpeed', 'timeOffset'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'breathing',
      label: 'Breathing',
      parameters: ['breatheAmount', 'breatheSpeed'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['rotSpeedXZ', 'rotSpeedXY', 'scale', 'wobbleSpeed', 'sineAmp'],
        layout: { columns: 3, parameterSpan: { wobbleSpeed: 2 } }
      },
      {
        type: 'grid',
        label: 'Position',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Animation',
        parameters: ['timeSpeed', 'timeOffset'],
        layout: { columns: 3, parameterSpan: { timeOffset: 2 } }
      },
      {
        type: 'grid',
        label: 'Breathing',
        parameters: ['breatheAmount', 'breatheSpeed'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
mat2 etherSdfRot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}
float etherSdfMap(vec3 p, float t, float rotXZ, float rotXY, float scale, float wobble, float sineAmp) {
  p.xz = etherSdfRot2(t * rotXZ) * p.xz;
  p.xy = etherSdfRot2(t * rotXY) * p.xy;
  vec3 q = p * scale + t;
  float radial = length(p + vec3(sin(t * wobble), 0.0, 0.0)) * log(length(p) + 1.0);
  return radial + sin(q.x + sin(q.z + sin(q.y))) * sineAmp - 1.0;
}
`,
  mainCode: `
  vec3 etherCenter = vec3($param.positionX, $param.positionY, $param.positionZ);
  float etherT = $time * $param.timeSpeed + $param.timeOffset;
  float etherBreathe = sin(etherT * $param.breatheSpeed) * $param.breatheAmount;
  vec3 etherPos = $input.position - (etherCenter + vec3(0.0, 0.0, etherBreathe));
  $output.out = etherSdfMap(etherPos, etherT, $param.rotSpeedXZ, $param.rotSpeedXY, $param.scale, $param.wobbleSpeed, $param.sineAmp);
`
};
