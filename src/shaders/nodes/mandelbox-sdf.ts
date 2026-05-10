import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Mandelbox SDF — fold / sphere-fold / scale–translate iterations (vec3 → float).
 * Conservative sphere-tracing DE with tunable deFudge; connect to generic-raymarcher SDF.
 */
export const mandelboxSdfNodeSpec: NodeSpec = {
  id: 'mandelbox-sdf',
  category: 'SDF',
  displayName: 'Mandelbox SDF',
  description:
    'Classic Mandelbox signed distance: box fold, sphere fold, then scale and offset each iteration. Visually distinct from KIFS and Menger; still fold-heavy. Wire out → SDF Raymarch sdf (the raymarcher supplies positions). Combine with Displacement 3D or Repeated Hex Prism SDF for layered looks.',
  icon: 'cube',
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
      default: -2.0,
      min: -5.0,
      max: 5.0,
      step: 0.01,
      label: 'Scale',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    foldingLimit: {
      type: 'float',
      default: 1.0,
      min: 0.05,
      max: 4.0,
      step: 0.01,
      label: 'Folding limit',
      supportsAnimation: true,
      supportsAudio: true
    },
    minRadius: {
      type: 'float',
      default: 0.25,
      min: 0.001,
      max: 2.0,
      step: 0.001,
      label: 'Min radius',
      supportsAnimation: true,
      supportsAudio: true
    },
    iterations: {
      type: 'int',
      default: 10,
      min: 1,
      max: 32,
      step: 1,
      label: 'Iterations',
      supportsAnimation: false,
      supportsAudio: false
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
      label: 'Angle',
      supportsAnimation: true,
      supportsAudio: true,
      knobPolarity: 'two-sided'
    },
    deFudge: {
      type: 'float',
      default: 1.15,
      min: 0.25,
      max: 4.0,
      step: 0.01,
      label: 'DE multiplier',
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
      id: 'core',
      label: 'Core',
      parameters: ['scale', 'foldingLimit', 'minRadius', 'iterations'],
      collapsible: false,
      defaultCollapsed: false
    },
    {
      id: 'offsetRotate',
      label: 'Offset / rotate',
      parameters: [
        'offsetX',
        'offsetY',
        'offsetZ',
        'rotationAxisX',
        'rotationAxisY',
        'rotationAxisZ',
        'rotationAngle'
      ],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'advanced',
      label: 'Advanced',
      parameters: ['deFudge'],
      collapsible: true,
      defaultCollapsed: true
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
        parameters: ['scale', 'foldingLimit', 'minRadius', 'iterations'],
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
        label: 'DE',
        parameters: ['deFudge'],
        layout: { columns: 1 }
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
// Quaternion → mat3 (same convention as KIFS node)
mat3 mandelboxSdfQuatToMat3(vec4 q) {
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

mat3 mandelboxSdfAxisAngleToMat3(vec3 axis, float angle) {
  float axl = length(axis);
  vec3 n = axl > 1e-5 ? axis / axl : vec3(0.0, 1.0, 0.0);
  return mandelboxSdfQuatToMat3(vec4(n * sin(angle), cos(angle)));
}

void mandelboxSdfBoxFold(inout vec3 z, float fl) {
  z = clamp(z, -fl, fl) * 2.0 - z;
}

void mandelboxSdfSphereFold(inout vec3 z, float minR2, float foldL2) {
  float r2 = dot(z, z);
  float k = max(foldL2 / max(minR2, r2), 1.0);
  k = min(k, 1e4);
  z *= k;
}

float mandelbox_sdf_eval(
  vec3 p0,
  float scale,
  float foldingLimit,
  float minRadius,
  int iterations,
  vec3 offset,
  mat3 rotM,
  float deFudge
) {
  vec3 z = p0 * rotM;
  vec3 c = offset;
  float fl = max(foldingLimit, 1e-4);
  float minR2 = minRadius * minRadius;
  float foldL2 = fl * fl;
  float D = 1.0;
  float sm = max(abs(scale), 1e-4);

  for (int i = 0; i < 32; i++) {
    if (i >= iterations) break;
    mandelboxSdfBoxFold(z, fl);
    mandelboxSdfSphereFold(z, minR2, foldL2);
    z = scale * z + c;
    D = D * sm + 1.0;
  }
  return length(z) / max(D, 1e-6) * deFudge;
}
`,
  mainCode: `
  vec3 offset = vec3($param.offsetX, $param.offsetY, $param.offsetZ);
  vec3 axis = vec3($param.rotationAxisX, $param.rotationAxisY, $param.rotationAxisZ);
  mat3 rotM = mandelboxSdfAxisAngleToMat3(axis, $param.rotationAngle);
  $output.out = mandelbox_sdf_eval(
    $input.position,
    $param.scale,
    $param.foldingLimit,
    $param.minRadius,
    $param.iterations,
    offset,
    rotM,
    $param.deFudge
  );
`
};
