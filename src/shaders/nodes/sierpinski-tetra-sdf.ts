import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Sierpinski tetrahedron IFS as 3D SDF (vec3 → float) for generic raymarching.
 * Tetrahedral folds (Knighty / Klems style) plus per-iteration scale and offset;
 * optional axis-angle pre-rotation. Inner distance is a scaled sphere (KIFS-style),
 * not a full sdTetrahedron shell — see node docs.
 * Reference fold+scale structure: Knighty IFS notes; common Shadertoy tetra IFS variants.
 */
export const sierpinskiTetraSdfNodeSpec: NodeSpec = {
  id: 'sierpinski-tetra-sdf',
  category: 'SDF',
  displayName: 'Sierpinski Tetra SDF',
  description:
    '3D SDF for a Sierpinski tetrahedron–style IFS: tetrahedral folds, per-iteration IFS scale and offset, optional pre-rotation. Rotation axis is normalized in the shader; angle is radians. Triangular lacunarity, not box or Menger cuts. Wire out → SDF Raymarch sdf. Advanced: core radius and DE bias on the KIFS-style sphere core.',
  icon: 'triangles',
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
    scale: {
      type: 'float',
      default: 2.0,
      min: 1.5,
      max: 3.5,
      step: 0.01,
      label: 'IFS scale',
      supportsAnimation: true,
      supportsAudio: true
    },
    offsetX: {
      type: 'float',
      default: 1.0,
      min: -3.0,
      max: 3.0,
      step: 0.05,
      label: 'Offset X',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    offsetY: {
      type: 'float',
      default: 1.0,
      min: -3.0,
      max: 3.0,
      step: 0.05,
      label: 'Offset Y',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    offsetZ: {
      type: 'float',
      default: 1.0,
      min: -3.0,
      max: 3.0,
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
      label: 'Axis X',
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
      label: 'Axis Y',
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
      label: 'Axis Z',
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
    iterations: {
      type: 'int',
      default: 8,
      min: 1,
      max: 12,
      step: 1,
      label: 'Iterations',
      supportsAnimation: false,
      supportsAudio: false
    },
    coreRadius: {
      type: 'float',
      default: 0.12,
      min: 0.0,
      max: 1.5,
      step: 0.01,
      label: 'Core radius',
      supportsAnimation: true,
      supportsAudio: true
    },
    deBias: {
      type: 'float',
      default: 0.0,
      min: -0.5,
      max: 0.5,
      step: 0.001,
      label: 'DE bias',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
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
      id: 'ifs',
      label: 'IFS',
      parameters: ['scale', 'iterations', 'offsetX', 'offsetY', 'offsetZ'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'rotation',
      label: 'Rotation',
      parameters: ['rotationAxisX', 'rotationAxisY', 'rotationAxisZ', 'rotationAngle'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'advanced',
      label: 'Advanced',
      parameters: ['coreRadius', 'deBias'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'position',
      label: 'Manual position',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        parameters: ['scale', 'iterations'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Offset',
        parameters: ['offsetX', 'offsetY', 'offsetZ'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Rotation',
        parameters: ['rotationAxisX', 'rotationAxisY', 'rotationAxisZ', 'rotationAngle'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Advanced',
        parameters: ['coreRadius', 'deBias'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Manual position',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// Quaternion to mat3 (unique names for this node)
mat3 stetraQuatToMat3(vec4 q) {
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

mat3 stetraAxisAngleToMat3(vec3 axis, float angle) {
  vec3 n = normalize(axis);
  return stetraQuatToMat3(vec4(n * sin(angle), cos(angle)));
}

// Tetrahedral folding (Knighty / Klems tetra IFS wedge).
void stetraFoldTetrahedron(inout vec3 z) {
  if (z.x + z.y < 0.0) z.xy = -z.yx;
  if (z.x + z.z < 0.0) z.xz = -z.zx;
  if (z.y + z.z < 0.0) z.yz = -z.zy;
}

// Sphere-in-scaled-space DE; min with solid is KIFS-style, not full sdTetrahedron.
float stetraSdfBody(vec3 p, mat3 preRot, float scl, vec3 ofs, int iters, float coreR, float deB) {
  vec3 z = preRot * p;
  float w = 1.0;
  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;
    stetraFoldTetrahedron(z);
    z = z * scl - ofs * (scl - 1.0);
    w *= scl;
  }
  return (length(z) / w) - coreR - deB;
}
`,
  mainCode: `
  vec3 stOfs = vec3($param.offsetX, $param.offsetY, $param.offsetZ);
  vec3 stAxis = vec3($param.rotationAxisX, $param.rotationAxisY, $param.rotationAxisZ);
  mat3 stM = stetraAxisAngleToMat3(stAxis, $param.rotationAngle);
  $output.out = stetraSdfBody($input.position, stM, $param.scale, stOfs, $param.iterations, $param.coreRadius, $param.deBias);
`
};
