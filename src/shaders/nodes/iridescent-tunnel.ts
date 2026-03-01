import type { NodeSpec } from '../../types/nodeSpec';

/**
 * Iridescent Tunnel node: volumetric raymarched infinite cylinders in a 3D
 * repeated, warped, rotating space with view-dependent iridescent coloring.
 * Port-inspired from Shadertoy 4ddSDS; self-contained (warp + 3D repetition + cylinder SDF + soft accumulation + iridescent color).
 */
export const iridescentTunnelNodeSpec: NodeSpec = {
  id: 'iridescent-tunnel',
  category: 'Shapes',
  displayName: 'Iridescent',
  description:
    'Volumetric raymarched infinite cylinders in a 3D repeated, warped, rotating space with view-dependent iridescent coloring.',
  icon: 'cylinder',
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
    repetitionScale: {
      type: 'float',
      default: 0.3,
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: 'Repetition',
      inputMode: 'override'
    },
    tubeRadius: {
      type: 'float',
      default: 0.12,
      min: 0.02,
      max: 0.5,
      step: 0.01,
      label: 'Tube size'
    },
    warpFreq: {
      type: 'float',
      default: 4.0,
      min: 0.0,
      max: 20.0,
      step: 0.1,
      label: 'Warp freq'
    },
    warpStrength: {
      type: 'float',
      default: 0.08,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Warp strength'
    },
    cameraSpeed: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 3.0,
      step: 0.05,
      label: 'Speed',
      inputMode: 'override'
    },
    rotateSpeed: {
      type: 'float',
      default: 0.3,
      min: -2.0,
      max: 2.0,
      step: 0.05,
      label: 'Rotate'
    },
    raymarchSteps: {
      type: 'int',
      default: 64,
      min: 24,
      max: 128,
      step: 1,
      label: 'Steps'
    },
    densityScale: {
      type: 'float',
      default: 1.0,
      min: 0.2,
      max: 3.0,
      step: 0.1,
      label: 'Density'
    },
    iridescenceMix: {
      type: 'float',
      default: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Iridescence'
    },
    iridescenceShift: {
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Color shift'
    },
    fovScale: {
      type: 'float',
      default: 1.0,
      min: 0.3,
      max: 2.0,
      step: 0.05,
      label: 'FOV'
    }
  },
  parameterGroups: [
    {
      id: 'tunnel',
      label: 'Tunnel',
      parameters: ['repetitionScale', 'tubeRadius', 'warpFreq', 'warpStrength'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'camera',
      label: 'Camera',
      parameters: ['cameraSpeed', 'rotateSpeed', 'fovScale'],
      collapsible: true,
      defaultCollapsed: false
    },
    {
      id: 'march',
      label: 'Raymarch',
      parameters: ['raymarchSteps', 'densityScale'],
      collapsible: true,
      defaultCollapsed: true
    },
    {
      id: 'color',
      label: 'Iridescence',
      parameters: ['iridescenceMix', 'iridescenceShift'],
      collapsible: true,
      defaultCollapsed: false
    }
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'Tunnel',
        parameters: ['repetitionScale', 'tubeRadius', 'warpFreq', 'warpStrength'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Camera',
        parameters: ['cameraSpeed', 'rotateSpeed', 'fovScale'],
        layout: { columns: 3 }
      },
      {
        type: 'grid',
        label: 'Raymarch',
        parameters: ['raymarchSteps', 'densityScale'],
        layout: { columns: 2 }
      },
      {
        type: 'grid',
        label: 'Iridescence',
        parameters: ['iridescenceMix', 'iridescenceShift'],
        layout: { columns: 2 }
      }
    ]
  },
  functions: `
// Z-rotation matrix (angle in radians)
mat3 getRotZMat(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

// Map: 3D warp + Z-rotation + 3D domain repetition + infinite cylinder SDF
float mapTunnel(vec3 p, float rep, float r, float wFreq, float wStr, float angle) {
  vec3 q = p;
  q.x += sin(q.z * wFreq) * wStr;
  q.y += cos(q.z * wFreq * 1.3) * wStr;
  q = getRotZMat(angle) * q;
  vec3 repVal = vec3(rep, rep, rep);
  q = mod(q + repVal * 0.5, repVal) - repVal * 0.5;
  return length(q.xy) - r;
}
`,
  mainCode: `
  float rep = clamp($param.repetitionScale, 0.1, 2.0);
  float r = clamp($param.tubeRadius, 0.02, 0.5);
  float wFreq = $param.warpFreq;
  float wStr = clamp($param.warpStrength, 0.0, 0.5);
  float angle = $time * $param.rotateSpeed;
  float speed = $param.cameraSpeed;
  float fov = $param.fovScale;
  int maxSteps = int(clamp(float($param.raymarchSteps), 24.0, 128.0));
  float densScale = clamp($param.densityScale, 0.2, 3.0);
  float iridMix = clamp($param.iridescenceMix, 0.0, 1.0);
  float iridShift = clamp($param.iridescenceShift, 0.0, 1.0);

  vec3 ro = vec3(0.0, 0.0, -$time * speed);
  vec2 uv = $input.in * 2.0 - 1.0;
  uv *= fov;
  vec3 rd = normalize(vec3(uv.x, uv.y, -1.0));

  vec4 acc = vec4(0.0);
  mediump float t = 0.0;
  const float maxDist = 30.0;

  for (int i = 0; i < 128; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + t * rd;
    float d = mapTunnel(p, rep, r, wFreq, wStr, angle);
    d = max(d, 0.001);

    vec3 cylN = normalize(vec3(p.xy, 0.0));
    float viewF = 1.0 - abs(dot(rd, cylN));
    viewF = pow(viewF, 1.5);
    vec3 colorA = vec3(0.2, 0.4, 0.9);
    vec3 colorB = vec3(0.9, 0.3, 0.5);
    vec3 iridColor = mix(colorA, colorB, viewF * iridShift + (1.0 - iridShift) * 0.5);
    vec3 baseColor = mix(vec3(0.15, 0.2, 0.35), iridColor, iridMix);

    float contrib = (1.0 / (1.0 + d * 8.0)) * densScale * 0.08;
    acc.rgb += baseColor * contrib * max(t, 0.05);
    acc.a += contrib * 0.5;

    t += max(d * 0.5, 0.008);
    if (t > maxDist) break;
  }

  acc.rgb = acc.rgb / (1.0 + acc.a);
  acc.a = clamp(acc.a * 1.2, 0.0, 1.0);
  $output.out += vec4(acc.rgb, acc.a);
`
};
