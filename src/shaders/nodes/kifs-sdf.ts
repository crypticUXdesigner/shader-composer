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
    '3D Kaleidoscopic IFS SDF: iterative fold (abs), scale, offset, and rotation. Output signed distance for raymarching. Connect position to generic raymarcher; use orbit camera (when ro/rd supported) for Larval-style fractals.',
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
      label: 'Distance'
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
      supportsAudio: true
    },
    offsetY: {
      type: 'float',
      default: -2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Offset Y',
      supportsAnimation: true,
      supportsAudio: true
    },
    offsetZ: {
      type: 'float',
      default: -0.2,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Offset Z',
      supportsAnimation: true,
      supportsAudio: true
    },
    rotationAxisX: {
      type: 'float',
      default: 1.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Axis X',
      supportsAnimation: true,
      supportsAudio: true
    },
    rotationAxisY: {
      type: 'float',
      default: 4.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Axis Y',
      supportsAnimation: true,
      supportsAudio: true
    },
    rotationAxisZ: {
      type: 'float',
      default: 2.0,
      min: -5.0,
      max: 5.0,
      step: 0.1,
      label: 'Axis Z',
      supportsAnimation: true,
      supportsAudio: true
    },
    rotationAngle: {
      type: 'float',
      default: 0.0,
      min: -6.28,
      max: 6.28,
      step: 0.05,
      label: 'Angle',
      supportsAnimation: true,
      supportsAudio: true
    },
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
      label: 'Radius',
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
      supportsAudio: true
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
      supportsAudio: true
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
      supportsAudio: true
    }
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
      label: 'Position (when unconnected)',
      parameters: ['positionX', 'positionY', 'positionZ'],
      collapsible: true,
      defaultCollapsed: true
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
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
        label: 'Position',
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
