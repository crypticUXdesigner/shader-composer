import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Menger sponge–style SDF (mod-3 recursive void cuts).
 * vec3 position in → float SDF out. Connect to generic raymarcher SDF port.
 * Distance field loosely follows the classic mod/grid formulation (e.g. IQ-style Menger).
 */
export const mengerSpongeSdfNodeSpec: NodeSpec = {
  id: 'menger-sponge-sdf',
  category: 'SDF',
  displayName: 'Menger Sponge SDF',
  description:
    '3D Menger sponge–style signed distance: iterative 3×3×3 void cuts in a cube. Connect **Position** from SDF Raymarch; tune iterations, domain scale, wall thickness, offset, and rotation. Advanced **DE scale** multiplies the distance returned to the marcher — higher values enlarge each ray step for speed; lower is safer through thin lattice.',
  icon: 'grid',
  inputs: [
    {
      name: 'position',
      type: 'vec3',
      label: 'Position',
      fallbackParameter: 'positionX,positionY,positionZ'
    }
  ],
  outputs: [
    {
      name: 'out',
      type: 'float',
      label: 'SDF'
    }
  ],
  parameters: {
    iterations: {
      type: 'int',
      default: 3,
      min: 1,
      max: 5,
      step: 1,
      label: 'Iterations',
      supportsAnimation: false,
      supportsAudio: false
    },
    domainScale: {
      type: 'float',
      default: 1.0,
      min: 0.05,
      max: 8.0,
      step: 0.01,
      label: 'Domain scale',
      supportsAnimation: true,
      supportsAudio: true
    },
    wallThickness: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 0.22,
      step: 0.005,
      label: 'Wall thickness',
      supportsAnimation: true,
      supportsAudio: true
    },
    offsetX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.05,
      label: 'Offset X',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    offsetY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.05,
      label: 'Offset Y',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    offsetZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.05,
      label: 'Offset Z',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    rotationAxisX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Rot axis X',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    rotationAxisY: {
      type: 'float',
      default: 1.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Rot axis Y',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    rotationAxisZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Rot axis Z',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    rotationAngle: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Angle rad',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    deFudge: {
      type: 'float',
      default: 0.2,
      min: 0.05,
      max: 1.0,
      step: 0.01,
      label: 'DE scale',
      supportsAnimation: true,
      supportsAudio: true
    },
    positionX: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos X',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    positionY: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Y',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    positionZ: {
      type: 'float',
      default: 0.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Pos Z',
      inputMode: 'override',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    }
  },
  parameterGroups: [
    {
      id: 'menger',
      label: 'Menger',
      parameters: ['iterations', 'domainScale', 'wallThickness'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'offset',
      label: 'Offset',
      parameters: ['offsetX', 'offsetY', 'offsetZ'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'rotation',
      label: 'Rotate',
      parameters: ['rotationAxisX', 'rotationAxisY', 'rotationAxisZ', 'rotationAngle'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'position',
      label: 'Fallback pos',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'advanced',
      label: 'Advanced',
      parameters: ['deFudge'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['iterations', 'domainScale', 'wallThickness'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Offset',
        parameters: ['offsetX', 'offsetY', 'offsetZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Rotate',
        parameters: ['rotationAxisX', 'rotationAxisY', 'rotationAxisZ', 'rotationAngle'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Fallback pos',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Advanced',
        parameters: ['deFudge'],
        layout: { columns: 1 }
      }
    ]
  },
  functions: `
mat3 mengerSponge_quatToMat3(vec4 q) {
  vec4 qSq = q * q;
  float xy2 = q.x * q.y * 2.0;
  float xz2 = q.x * q.z * 2.0;
  float yz2 = q.y * q.z * 2.0;
  float wx2 = q.w * q.x * 2.0;
  float wy2 = q.w * q.y * 2.0;
  float wz2 = q.w * q.z * 2.0;
  return mat3(
    qSq.w + qSq.x - qSq.y - qSq.z, xy2 - wz2, xz2 + wy2,
    xy2 + wz2, qSq.w - qSq.x + qSq.y - qSq.z, yz2 - wx2,
    xz2 - wy2, yz2 + wx2, qSq.w - qSq.x - qSq.y + qSq.z
  );
}

mat3 mengerSponge_axisAngleToMat3(vec3 ax, float angle) {
  vec3 n = length(ax) > 1e-5 ? normalize(ax) : vec3(0.0, 1.0, 0.0);
  return mengerSponge_quatToMat3(vec4(n * sin(angle), cos(angle)));
}

float mengerSponge_sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float mengerSponge_eval(vec3 z, int maxIter, float wallThick, float deMul) {
  float d = mengerSponge_sdBox(z, vec3(1.0));
  float s = 1.0;
  for (int i = 0; i < 5; i++) {
    if (i >= maxIter) break;
    vec3 a = mod(z * s + 1.0, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0 * abs(a));
    float rc = max(r.x, max(r.y, r.z));
    float cut = max(rc - wallThick, 1e-5);
    d = min(d, cut / s);
    z = a;
  }
  return clamp(d * deMul, 0.0, 50.0);
}
`,
  mainCode: `
  vec3 mengerOff = vec3($param.offsetX, $param.offsetY, $param.offsetZ);
  vec3 mengerAxis = vec3($param.rotationAxisX, $param.rotationAxisY, $param.rotationAxisZ);
  mat3 mengerRot = mengerSponge_axisAngleToMat3(mengerAxis, $param.rotationAngle);
  vec3 mengerP = mengerRot * ($input.position + mengerOff);
  mengerP *= $param.domainScale;
  $output.out = mengerSponge_eval(mengerP, $param.iterations, $param.wallThickness, $param.deFudge);
`
};
