import type { NodeSpec } from '../../types/nodeSpec';

/**
 * KIFS SDF (Kaleidoscopic IFS)
 * 3D SDF from iterated fold (abs), scale, offset, and rotation. Reference: Shadertoy Larval (ldB3Rz).
 * vec3 position in → float SDF out. Connect to generic raymarcher SDF input.
 */
export const kifsSdfNodeSpec: NodeSpec = {
  id: 'kifs-sdf',
  category: 'SDF',
  displayName: 'KIFS SDF',
  description:
    'Kaleidoscopic IFS in 3D: absolute fold each iteration, multiply by scale, add offset, then rotate. Outputs signed distance for SDF Raymarch; orbit camera ro and rd give Larval-style motion. Rotation axis X/Y/Z is normalized in the shader; angle is radians. Scale stays at least 1 so iterations expand the folded volume like typical KIFS setups. Core radius sets the terminating sphere inside the iterated point. Estimated distance fields may band or leak—raise SDF Raymarch steps or tighten its safety controls if artifacts show.',
  icon: 'sphere',
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
      default: 1.25,
      min: 1.0,
      max: 3.0,
      step: 0.01,
      label: 'Scale',
      supportsAnimation: true,
      supportsAudio: true
    },
    offsetX: {
      type: 'float',
      default: -1.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Offset X',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    offsetY: {
      type: 'float',
      default: -2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Offset Y',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    offsetZ: {
      type: 'float',
      default: -0.2,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Offset Z',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    rotationAxisX: {
      type: 'float',
      default: 1.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Axis X',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    rotationAxisY: {
      type: 'float',
      default: 4.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Axis Y',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    rotationAxisZ: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Axis Z',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    rotationAngle: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Angle',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided' },
    iterations: {
      type: 'int',
      default: 16,
      min: 1,
      max: 32,
      step: 1,
      label: 'Iterations',
      supportsAnimation: false,
      supportsAudio: false
    },
    sphereRadius: {
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Core radius',
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
      knobPolarity: 'two-sided' },
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
      knobPolarity: 'two-sided' },
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
      knobPolarity: 'two-sided' }
  },
  parameterGroups: [
    {
      id: 'kifs',
      label: 'KIFS',
      parameters: ['scale', 'iterations', 'sphereRadius'],
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
      label: 'Rotation',
      parameters: ['rotationAxisX', 'rotationAxisY', 'rotationAxisZ', 'rotationAngle'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'position',
      label: 'Fallback position',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'KIFS',
        parameters: ['scale', 'iterations', 'sphereRadius'],
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
        label: 'Rotation',
        parameters: ['rotationAxisX', 'rotationAxisY', 'rotationAxisZ', 'rotationAngle'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Fallback position',
        parameters: ['positionX', 'positionY', 'positionZ'],
        layout: { columns: 3 }
      }
    ]
  },
  functions: `
// mat3 from quaternion (Larval SetRot)
mat3 kifsQuatToMat3(vec4 q) {
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

// mat3 from axis-angle
mat3 kifsAxisAngleToMat3(vec3 axis, float angle) {
  vec3 n = normalize(axis);
  return kifsQuatToMat3(vec4(n * sin(angle), cos(angle)));
}

float kifsSdf(vec3 p, float scale, vec3 offset, mat3 m, int iterations, float radius) {
  float totalScale = 1.0;
  for (int i = 0; i < 32; i++) {
    if (i >= iterations) break;
    p = abs(p);
    p *= scale;
    totalScale *= scale;
    p += offset;
    p = p * m;
  }
  return length(p) / totalScale - radius;
}
`,
  mainCode: `
  vec3 offset = vec3($param.offsetX, $param.offsetY, $param.offsetZ);
  vec3 axis = vec3($param.rotationAxisX, $param.rotationAxisY, $param.rotationAxisZ);
  mat3 m = kifsAxisAngleToMat3(axis, $param.rotationAngle);
  $output.out = kifsSdf($input.position, $param.scale, offset, m, $param.iterations, $param.sphereRadius);
`
};
